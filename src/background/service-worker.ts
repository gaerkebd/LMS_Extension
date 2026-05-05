/**
 * Background Service Worker
 * Handles background tasks, alarms, and message passing for the extension.
 * Also enforces licensing/tier limits for AI refreshes.
 *
 * Storage layout (chrome.storage.local):
 *   cachedAssignments : AssignmentInput[]   — assignment metadata
 *   aiEstimateResults : AIEstimateResult[]  — estimates keyed by assignmentID
 *   lastUpdated       : number              — epoch ms of last successful refresh
 */

import { CanvasAPI } from '../services/canvas-api';
import { TimeEstimator } from '../services/time-estimator';
import { licensingService } from '../services/licensing';
import { analyticsService } from '../services/analytics';
import { calendarService } from '../services/calendar';
import type { Assignment, AssignmentInput, AIEstimateResult } from '../types';

// Constants
const REFRESH_ALARM = 'refresh-assignments';
const VALIDATE_LICENSE_ALARM = 'validate-license';
const REFRESH_INTERVAL_MINUTES = 30;
const LICENSE_CHECK_INTERVAL_MINUTES = 60 * 24; // once per day

/**
 * Initialize the extension when installed or updated
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.alarms.create(REFRESH_ALARM, {
    periodInMinutes: REFRESH_INTERVAL_MINUTES,
  });

  await chrome.alarms.create(VALIDATE_LICENSE_ALARM, {
    periodInMinutes: LICENSE_CHECK_INTERVAL_MINUTES,
  });

  if (details.reason === 'install') {
    await chrome.storage.sync.set({
      refreshInterval: REFRESH_INTERVAL_MINUTES,
      showNotifications: true,
      aiProvider: 'none',
      estimationModel: 'gpt-4o-mini',
    });

    await licensingService.startTrial();
  }
});

/**
 * Handle alarm events
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    await refreshAssignmentsInBackground();
  } else if (alarm.name === VALIDATE_LICENSE_ALARM) {
    await licensingService.refreshValidation();
  }
});

/**
 * Shape returned by CanvasAPI.getAssignmentsDueWithinDays (NormalizedAssignment
 * is a private interface in canvas-api.ts, so we match it structurally).
 */
interface CanvasNormalized {
  id: number;
  title: string;
  type: string;
  dueDate: string | null;
  courseName: string;
  courseId: number;
  pointsPossible: number | null;
  htmlUrl: string;
  submissionTypes: string[];
  description: string;
}

/**
 * Map a normalized Canvas assignment to the leaner AssignmentInput shape.
 */
function toAssignmentInput(a: CanvasNormalized): AssignmentInput {
  return {
    assignmentID: a.id,
    title: a.title,
    type: a.type,
    courseName: a.courseName,
    courseId: a.courseId,
    dueDate: a.dueDate ?? '',
    htmlUrl: a.htmlUrl,
    pointsPossible: a.pointsPossible ?? undefined,
    submissionTypes: a.submissionTypes,
    description: a.description,
  };
}

/**
 * Merge AssignmentInput[] + AIEstimateResult[] back into Assignment[] for
 * consumers that still expect the combined shape (popup, analytics, etc.).
 */
function mergeToAssignments(
  inputs: AssignmentInput[],
  estimates: AIEstimateResult[],
): Assignment[] {
  const estimateMap = new Map(estimates.map(e => [e.assignmentID, e]));

  return inputs.map(input => {
    const estimate = estimateMap.get(input.assignmentID);
    return {
      id: input.assignmentID,
      title: input.title,
      type: input.type as Assignment['type'],
      courseName: input.courseName,
      courseId: input.courseId,
      dueDate: input.dueDate,
      htmlUrl: input.htmlUrl,
      description: input.description || '',
      pointsPossible: input.pointsPossible || 0,
      submissionTypes: input.submissionTypes || [],
      estimatedMinutes: estimate?.minutes ?? null,
      estimationConfidence: null,
    };
  });
}

/**
 * Refresh assignments in the background.
 * Writes cachedAssignments and aiEstimateResults to chrome.storage.local.
 */
async function refreshAssignmentsInBackground() {
  try {
    const settings = await chrome.storage.sync.get(['canvasUrl', 'apiToken', 'lookaheadDays']);

    if (!settings.canvasUrl || !settings.apiToken) {
      return;
    }

    const canvasAPI = new CanvasAPI();
    canvasAPI.configure(settings.canvasUrl, settings.apiToken);

    const maxLookahead = await licensingService.getMaxLookaheadDays();
    const daysAhead = Math.min(settings.lookaheadDays || 14, maxLookahead);
    const rawAssignments = await canvasAPI.getAssignmentsDueWithinDays(daysAhead);

    // Convert to the lean AssignmentInput shape
    const inputAssignments: AssignmentInput[] = rawAssignments.map(toAssignmentInput);

    const canUseAI = await licensingService.canUseAIRefresh();
    const timeEstimator = new TimeEstimator();

    let aiEstimateResults: AIEstimateResult[];

    if (canUseAI) {
      aiEstimateResults = await timeEstimator.estimateAll(inputAssignments);
      const aiSettings = await chrome.storage.sync.get(['aiProvider']);
      if (aiSettings.aiProvider && aiSettings.aiProvider !== 'none') {
        await licensingService.incrementAIRefreshCount();
      }
    } else {
      // Free tier exhausted — heuristics only
      aiEstimateResults = inputAssignments.map(a => ({
        assignmentID: a.assignmentID,
        minutes: timeEstimator.getHeuristicEstimate(a),
      }));
    }

    // Persist the split cache
    await chrome.storage.local.set({
      cachedAssignments: inputAssignments,
      aiEstimateResults,
      lastUpdated: Date.now(),
    });

    // Analytics only needs courseName + estimatedMinutes
    const analyticsInput = aiEstimateResults.map(e => {
      const input = inputAssignments.find(a => a.assignmentID === e.assignmentID);
      return { courseName: input?.courseName, estimatedMinutes: e.minutes };
    });
    await analyticsService.recordSnapshot(analyticsInput);
    await checkForUrgentAssignments(inputAssignments);
  } catch (error) {
    console.error('Background refresh failed:', error);
  }
}

/**
 * Check for urgent assignments and send notifications
 */
async function checkForUrgentAssignments(assignments: AssignmentInput[]) {
  const settings = await chrome.storage.sync.get(['showNotifications']);
  if (!settings.showNotifications) return;

  const now = new Date();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  const urgent = assignments.filter(a => {
    if (!a.dueDate) return false;
    const dueDate = new Date(a.dueDate);
    return dueDate.getTime() - now.getTime() < twentyFourHours && dueDate > now;
  });

  if (urgent.length > 0) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../assets/icons/icon128.png',
      title: 'Canvas Assignments Due Soon',
      message: `You have ${urgent.length} assignment(s) due within 24 hours!`,
      priority: 2,
    });
  }
}

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep the message channel open for async response
});

/**
 * Process incoming messages
 */
async function handleMessage(
  message: {
    type: string;
    assignment?: Partial<Assignment>;
    url?: string;
    token?: string;
    daysAhead?: number;
    subscriptionId?: string;
  },
  _sender: chrome.runtime.MessageSender,
) {
  switch (message.type) {
    case 'OPEN_OPTIONS_PAGE':
      chrome.runtime.openOptionsPage();
      return { success: true };

    case 'GET_ASSIGNMENTS':
      return await getAssignments();

    case 'REFRESH_ASSIGNMENTS':
      await refreshAssignmentsInBackground();
      return { success: true };

    case 'GET_CACHED_ASSIGNMENTS': {
      const stored = await chrome.storage.local.get(['cachedAssignments', 'aiEstimateResults', 'lastUpdated']);
      // Return both raw arrays AND a merged array for any consumer that needs it
      return {
        cachedAssignments: stored.cachedAssignments || [],
        aiEstimateResults: stored.aiEstimateResults || [],
        lastUpdated: stored.lastUpdated,
      };
    }

    case 'ESTIMATE_SINGLE':
      if (message.assignment) {
        const estimator = new TimeEstimator();
        // ESTIMATE_SINGLE is called by the badge content-script which doesn't
        // have a Canvas assignmentID — use 0 as a placeholder.
        const input: AssignmentInput = {
          assignmentID:
            typeof message.assignment.id === 'number'
              ? message.assignment.id
              : parseInt(String(message.assignment.id ?? 0), 10),
          title: message.assignment.title || '',
          type: message.assignment.type || 'assignment',
          courseName: message.assignment.courseName || '',
          courseId: message.assignment.courseId || 0,
          dueDate: message.assignment.dueDate || '',
          htmlUrl: message.assignment.htmlUrl || '',
          pointsPossible: message.assignment.pointsPossible ?? undefined,
          submissionTypes: message.assignment.submissionTypes,
          description: message.assignment.description,
        };
        const result = await estimator.estimateSingle(input);
        // Expose estimatedMinutes for backward-compat with the badge content-script
        return { ...result, estimatedMinutes: result.minutes };
      }
      return { error: 'No assignment provided' };

    case 'TEST_CONNECTION':
      if (message.url && message.token) {
        return await testCanvasConnection(message.url, message.token);
      }
      return { success: false, error: 'Missing URL or token' };

    case 'FETCH_ASSIGNMENTS_DAYS_AHEAD':
      return await fetchAssignmentsDaysAhead(message.daysAhead || 7);

    // --- Licensing messages ---

    case 'GET_USER_TIER':
      return await licensingService.getCachedTier();

    case 'VALIDATE_SUBSCRIPTION':
      if (message.subscriptionId) {
        return await licensingService.validateSubscription(message.subscriptionId);
      }
      return { error: 'No subscription ID provided' };

    case 'GET_USAGE':
      return await licensingService.getUsageCounters();

    case 'CHECK_CAN_REFRESH':
      return { canRefresh: await licensingService.canUseAIRefresh() };

    case 'GET_FEATURE_FLAGS': {
      const tier = await licensingService.getCachedTier();
      return licensingService.getFeatureFlags(tier.tier);
    }

    case 'GET_ANALYTICS': {
      const tier = await licensingService.getCachedTier();
      const flags = licensingService.getFeatureFlags(tier.tier);
      if (!flags.advancedAnalytics) {
        return { error: 'Premium feature', history: [], summary: null };
      }
      const history = await analyticsService.getRecentHistory(14);
      const summary = await analyticsService.getSummary(14);
      return { history, summary };
    }

    case 'SYNC_CALENDAR': {
      const tier = await licensingService.getCachedTier();
      const flags = licensingService.getFeatureFlags(tier.tier);
      if (!flags.calendarIntegration) {
        return { error: 'Premium feature' };
      }
      try {
        const stored = await chrome.storage.local.get(['cachedAssignments', 'aiEstimateResults']);
        const merged = mergeToAssignments(
          stored.cachedAssignments || [],
          stored.aiEstimateResults || [],
        );
        const blocks = await calendarService.autoSchedule(merged);
        return { blocks };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Calendar sync failed' };
      }
    }

    default:
      return { error: 'Unknown message type' };
  }
}

/**
 * Get assignments (from cache or fresh fetch).
 * Returns merged Assignment[] for backward compat with the popup.
 */
async function getAssignments() {
  const stored = await chrome.storage.local.get(['cachedAssignments', 'aiEstimateResults', 'lastUpdated']);
  const cacheAge = Date.now() - (stored.lastUpdated || 0);
  const maxCacheAge = 5 * 60 * 1000; // 5 minutes

  const hasCache = stored.cachedAssignments && stored.aiEstimateResults;

  if (hasCache && cacheAge < maxCacheAge) {
    return {
      assignments: mergeToAssignments(stored.cachedAssignments, stored.aiEstimateResults),
      fromCache: true,
      lastUpdated: stored.lastUpdated,
    };
  }

  await refreshAssignmentsInBackground();
  const fresh = await chrome.storage.local.get(['cachedAssignments', 'aiEstimateResults', 'lastUpdated']);

  return {
    assignments: mergeToAssignments(fresh.cachedAssignments || [], fresh.aiEstimateResults || []),
    fromCache: false,
    lastUpdated: fresh.lastUpdated,
  };
}

/**
 * Test Canvas API connection
 */
async function testCanvasConnection(url: string, token: string) {
  try {
    const canvasAPI = new CanvasAPI();
    canvasAPI.configure(url, token);
    const isConnected = await canvasAPI.testConnection();
    return { success: isConnected };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch assignments due within X days
 */
async function fetchAssignmentsDaysAhead(daysAhead: number) {
  try {
    const settings = await chrome.storage.sync.get(['canvasUrl', 'apiToken']);

    if (!settings.canvasUrl || !settings.apiToken) {
      return { success: false, error: 'Canvas not configured. Please set URL and token in settings.' };
    }

    const canvasAPI = new CanvasAPI();
    canvasAPI.configure(settings.canvasUrl, settings.apiToken);

    const assignments = await canvasAPI.getAssignmentsDueWithinDays(daysAhead);
    return { success: true, assignments, count: assignments.length, daysAhead };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
