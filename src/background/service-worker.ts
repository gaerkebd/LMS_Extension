/**
 * Background Service Worker
 * Handles background tasks, alarms, and message passing for the extension.
 * Also enforces licensing/tier limits for AI refreshes.
 */

import { CanvasAPI } from '../services/canvas-api';
import { TimeEstimator } from '../services/time-estimator';
import { licensingService } from '../services/licensing';
import { analyticsService } from '../services/analytics';
import { calendarService } from '../services/calendar';
import type { Assignment } from '../types';

// Constants
const REFRESH_ALARM = 'refresh-assignments';
const VALIDATE_LICENSE_ALARM = 'validate-license';
const REFRESH_INTERVAL_MINUTES = 30;
const LICENSE_CHECK_INTERVAL_MINUTES = 60 * 24; // once per day

/**
 * Initialize the extension when installed or updated
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  // Set up periodic refresh alarm
  await chrome.alarms.create(REFRESH_ALARM, {
    periodInMinutes: REFRESH_INTERVAL_MINUTES,
  });

  // Set up daily license re-validation alarm
  await chrome.alarms.create(VALIDATE_LICENSE_ALARM, {
    periodInMinutes: LICENSE_CHECK_INTERVAL_MINUTES,
  });

  if (details.reason === 'install') {
    // Default settings
    await chrome.storage.sync.set({
      refreshInterval: REFRESH_INTERVAL_MINUTES,
      showNotifications: true,
      aiProvider: 'none',
      estimationModel: 'gpt-4o-mini',
    });

    // Start 7-day premium trial
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
 * Refresh assignments in the background.
 * Enforces AI refresh limits for free-tier users.
 */
async function refreshAssignmentsInBackground() {
  try {
    const settings = await chrome.storage.sync.get(['canvasUrl', 'apiToken', 'lookaheadDays']);

    if (!settings.canvasUrl || !settings.apiToken) {
      return;
    }

    const canvasAPI = new CanvasAPI();
    canvasAPI.configure(settings.canvasUrl, settings.apiToken);

    // Enforce lookahead cap based on tier
    const maxLookahead = await licensingService.getMaxLookaheadDays();
    const daysAhead = Math.min(settings.lookaheadDays || 14, maxLookahead);
    const rawAssignments = await canvasAPI.getAssignmentsDueWithinDays(daysAhead);

    const mappedAssignments = rawAssignments.map(a => ({
      ...a,
      pointsPossible: a.pointsPossible ?? undefined,
    }));

    // Check if AI refresh is allowed (free tier: 5/day)
    const canUseAI = await licensingService.canUseAIRefresh();

    const timeEstimator = new TimeEstimator();
    let assignments;

    if (canUseAI) {
      assignments = await timeEstimator.estimateAll(mappedAssignments);
      // Only count AI refreshes if the provider is actually an AI (not 'none')
      const aiSettings = await chrome.storage.sync.get(['aiProvider']);
      if (aiSettings.aiProvider && aiSettings.aiProvider !== 'none') {
        await licensingService.incrementAIRefreshCount();
      }
    } else {
      // Free tier exhausted: use heuristics only
      assignments = mappedAssignments.map(a => ({
        ...a,
        estimatedMinutes: timeEstimator.getHeuristicEstimate(a),
        estimationMethod: 'heuristic',
        estimatedAt: Date.now(),
      }));
    }

    // Cache the results
    await chrome.storage.local.set({
      cachedAssignments: assignments,
      lastUpdated: Date.now(),
    });

    // Record analytics snapshot (for premium analytics dashboard)
    await analyticsService.recordSnapshot(assignments);

    // Check for urgent assignments and notify
    await checkForUrgentAssignments(assignments);
  } catch (error) {
    console.error('Background refresh failed:', error);
  }
}

/**
 * Check for urgent assignments and send notifications
 */
async function checkForUrgentAssignments(assignments: Array<{ dueDate?: string; [key: string]: unknown }>) {
  const settings = await chrome.storage.sync.get(['showNotifications']);
  if (!settings.showNotifications) return;

  const now = new Date();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  const urgent = assignments.filter(a => {
    if (!a.dueDate) return false;
    const dueDate = new Date(a.dueDate as string);
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
  message: { type: string; assignment?: Partial<Assignment>; url?: string; token?: string; daysAhead?: number; subscriptionId?: string },
  _sender: chrome.runtime.MessageSender,
) {
  switch (message.type) {
    case 'GET_ASSIGNMENTS':
      return await getAssignments();

    case 'REFRESH_ASSIGNMENTS':
      await refreshAssignmentsInBackground();
      return { success: true };

    case 'GET_CACHED_ASSIGNMENTS':
      return await chrome.storage.local.get(['cachedAssignments', 'lastUpdated']);

    case 'ESTIMATE_SINGLE':
      if (message.assignment) {
        const estimator = new TimeEstimator();
        const estimate = await estimator.estimateSingle(message.assignment);
        return estimate;
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
        const cached = await chrome.storage.local.get(['cachedAssignments']);
        const assignments = cached.cachedAssignments || [];
        const blocks = await calendarService.autoSchedule(assignments);
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
 * Get assignments (from cache or fresh fetch)
 */
async function getAssignments() {
  const cached = await chrome.storage.local.get(['cachedAssignments', 'lastUpdated']);
  const cacheAge = Date.now() - (cached.lastUpdated || 0);
  const maxCacheAge = 5 * 60 * 1000; // 5 minutes

  if (cached.cachedAssignments && cacheAge < maxCacheAge) {
    return {
      assignments: cached.cachedAssignments,
      fromCache: true,
      lastUpdated: cached.lastUpdated,
    };
  }

  await refreshAssignmentsInBackground();
  const fresh = await chrome.storage.local.get(['cachedAssignments', 'lastUpdated']);

  return {
    assignments: fresh.cachedAssignments || [],
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
