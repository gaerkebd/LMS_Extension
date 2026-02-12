/**
 * Background Service Worker
 * Handles background tasks, alarms, and message passing for the extension
 */

import { CanvasAPI } from '../services/canvas-api.js';
import { TimeEstimator } from '../services/time-estimator.js';

// Constants
const REFRESH_ALARM = 'refresh-assignments';
const REFRESH_INTERVAL_MINUTES = 30;

/**
 * Initialize the extension when installed or updated
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Canvas Time Estimator installed/updated:', details.reason);

  // Set up periodic refresh alarm
  await chrome.alarms.create(REFRESH_ALARM, {
    periodInMinutes: REFRESH_INTERVAL_MINUTES
  });

  // Initialize default settings if first install
  if (details.reason === 'install') {
    await chrome.storage.sync.set({
      refreshInterval: REFRESH_INTERVAL_MINUTES,
      showNotifications: true,
      aiProvider: 'openai',
      estimationModel: 'gpt-3.5-turbo'
    });
  }
});

/**
 * Handle alarm events
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    await refreshAssignmentsInBackground();
  }
});

/**
 * Refresh assignments in the background
 */
async function refreshAssignmentsInBackground() {
  try {
    const settings = await chrome.storage.sync.get(['canvasUrl', 'apiToken']);

    if (!settings.canvasUrl || !settings.apiToken) {
      console.log('Canvas not configured, skipping background refresh');
      return;
    }

    const canvasAPI = new CanvasAPI();
    canvasAPI.configure(settings.canvasUrl, settings.apiToken);

    const rawAssignments = await canvasAPI.getTodoItems();
    const timeEstimator = new TimeEstimator();
    const assignments = await timeEstimator.estimateAll(rawAssignments);

    // Cache the results
    await chrome.storage.local.set({
      cachedAssignments: assignments,
      lastUpdated: Date.now()
    });

    // Check for urgent assignments and notify
    await checkForUrgentAssignments(assignments);

    console.log('Background refresh complete:', assignments.length, 'assignments');
  } catch (error) {
    console.error('Background refresh failed:', error);
  }
}

/**
 * Check for urgent assignments and send notifications
 */
async function checkForUrgentAssignments(assignments) {
  const settings = await chrome.storage.sync.get(['showNotifications']);

  if (!settings.showNotifications) return;

  const now = new Date();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  const urgent = assignments.filter(a => {
    const dueDate = new Date(a.dueDate);
    return dueDate - now < twentyFourHours && dueDate > now;
  });

  if (urgent.length > 0) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../assets/icons/icon128.png',
      title: 'Canvas Assignments Due Soon',
      message: `You have ${urgent.length} assignment(s) due within 24 hours!`,
      priority: 2
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
async function handleMessage(message, sender) {
  switch (message.type) {
    case 'GET_ASSIGNMENTS':
      return await getAssignments();

    case 'REFRESH_ASSIGNMENTS':
      await refreshAssignmentsInBackground();
      return { success: true };

    case 'GET_CACHED_ASSIGNMENTS':
      const cached = await chrome.storage.local.get(['cachedAssignments', 'lastUpdated']);
      return cached;

    case 'ESTIMATE_SINGLE':
      const estimator = new TimeEstimator();
      const estimate = await estimator.estimateSingle(message.assignment);
      return estimate;

    case 'TEST_CONNECTION':
      return await testCanvasConnection(message.url, message.token);

    default:
      console.warn('Unknown message type:', message.type);
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
      lastUpdated: cached.lastUpdated
    };
  }

  await refreshAssignmentsInBackground();
  const fresh = await chrome.storage.local.get(['cachedAssignments', 'lastUpdated']);

  return {
    assignments: fresh.cachedAssignments || [],
    fromCache: false,
    lastUpdated: fresh.lastUpdated
  };
}

/**
 * Test Canvas API connection
 */
async function testCanvasConnection(url, token) {
  try {
    const canvasAPI = new CanvasAPI();
    canvasAPI.configure(url, token);
    const isConnected = await canvasAPI.testConnection();
    return { success: isConnected };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Log that service worker is running
console.log('Canvas Time Estimator service worker initialized');
