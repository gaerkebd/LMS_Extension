import { useEffect, useState } from 'react';
import type { AssignmentInput, AIEstimateResult } from '../types';

/**
 * Merged view of one assignment — combines AssignmentInput metadata with its
 * AIEstimateResult via assignmentID so each source stays small in storage.
 */
interface DisplayAssignment {
  assignmentID: number;
  title: string;
  courseName: string;
  dueDate: string;
  htmlUrl: string;
  type: string;
  estimatedMinutes: number | null;
  reasoning?: string;
}

function mergeData(
  inputs: AssignmentInput[],
  estimates: AIEstimateResult[],
): DisplayAssignment[] {
  const estimateMap = new Map(estimates.map(e => [e.assignmentID, e]));
  return inputs.map(input => {
    const estimate = estimateMap.get(input.assignmentID);
    return {
      assignmentID: input.assignmentID,
      title: input.title,
      courseName: input.courseName,
      dueDate: input.dueDate,
      htmlUrl: input.htmlUrl,
      type: input.type,
      estimatedMinutes: estimate?.minutes ?? null,
      reasoning: estimate?.reasoning,
    };
  });
}

export function CanvasSidebar() {
  const [assignments, setAssignments] = useState<DisplayAssignment[]>([]);
  // loading is only true when there is literally no cache yet
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    loadFromCache();

    // React to background refreshes that happen while the sidebar is open
    const onStorageChanged = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.cachedAssignments || changes.aiEstimateResults) {
        loadFromCache();
      }
    };
    chrome.storage.local.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.local.onChanged.removeListener(onStorageChanged);
  }, []);

  /**
   * Read directly from chrome.storage.local — no service-worker round-trip
   * needed for display, so the sidebar renders instantly from cache.
   * If there is no cache at all, kick off a background refresh.
   */
  async function loadFromCache() {
    try {
      const settings = await chrome.storage.sync.get(['canvasUrl', 'apiToken']);

      if (!settings.canvasUrl || !settings.apiToken) {
        setError('Extension not configured');
        return;
      }

      const stored = await chrome.storage.local.get([
        'cachedAssignments',
        'aiEstimateResults',
      ]);

      if (stored.cachedAssignments && stored.aiEstimateResults) {
        // Cache exists — render immediately, no spinner needed
        setAssignments(mergeData(stored.cachedAssignments, stored.aiEstimateResults));
        setError(null);
      } else {
        // No cache at all — show spinner and trigger a fresh fetch
        setLoading(true);
        await triggerBackgroundRefresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Tell the service worker to fetch fresh data.
   * After it writes to storage, read back and update state.
   * We send the message but don't depend on the service worker being awake
   * for the initial display (that already happened via loadFromCache).
   */
  async function triggerBackgroundRefresh() {
    try {
      await chrome.runtime.sendMessage({ type: 'REFRESH_ASSIGNMENTS' });
      const stored = await chrome.storage.local.get([
        'cachedAssignments',
        'aiEstimateResults',
      ]);
      if (stored.cachedAssignments && stored.aiEstimateResults) {
        setAssignments(mergeData(stored.cachedAssignments, stored.aiEstimateResults));
        setError(null);
      }
    } catch (err) {
      console.error('Background refresh failed:', err);
      setError('Failed to refresh assignments');
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await triggerBackgroundRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  function openOptions() {
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
  }

  function formatTime(minutes: number | null): string {
    if (!minutes) return '?';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  function formatDueDate(dueDate: string): string {
    if (!dueDate) return '';
    const date = new Date(dueDate);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `${diffDays} days`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getTimeBadgeClass(minutes: number | null): string {
    if (!minutes) return '';
    if (minutes >= 180) return 'high';
    if (minutes >= 90) return 'medium';
    return '';
  }

  const totalMinutes = assignments.reduce(
    (sum, a) => sum + (a.estimatedMinutes || 0),
    0,
  );

  return (
    <div className="canvas-time-estimator-sidebar">
      <div className="cte-header">
        <h2 className="cte-title">Time Estimates</h2>
        <div className="cte-actions">
          <button
            onClick={handleRefresh}
            className={`cte-btn-icon${refreshing ? ' cte-btn-refreshing' : ''}`}
            title="Refresh"
            disabled={loading || refreshing}
          >
            {refreshing ? (
              <>
                <span className="cte-btn-spinner"></span>
                Refreshing...
              </>
            ) : (
              '🔄'
            )}
          </button>
          <button onClick={openOptions} className="cte-btn-icon" title="Settings">
            ⚙️
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="cte-btn-icon"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="cte-content">
          {/* Summary row — always visible once we have any data */}
          <div className="cte-summary">
            <div className="cte-summary-item">
              <span className="cte-summary-value">
                {loading ? '?' : assignments.length}
              </span>
              <span className="cte-summary-label">Assignments</span>
            </div>
            <div className="cte-summary-item">
              <span className="cte-summary-value">
                {loading ? '?' : formatTime(totalMinutes)}
              </span>
              <span className="cte-summary-label">Total Time</span>
            </div>
          </div>

          {/* Spinner only when there is genuinely no cached data yet */}
          {loading && (
            <div className="cte-loading">
              <div className="cte-spinner"></div>
              <p>Loading assignments...</p>
            </div>
          )}

          {/* Refreshing overlay — shows on top of the existing list */}
          {refreshing && !loading && (
            <div className="cte-loading">
              <div className="cte-spinner"></div>
              <p>Refreshing...</p>
            </div>
          )}

          {error && !loading && (
            <div className="cte-error">
              <p>{error}</p>
              <button onClick={openOptions} className="cte-btn-link">
                Configure Extension
              </button>
            </div>
          )}

          {!loading && !error && assignments.length === 0 && (
            <div className="cte-empty">
              <p>🎉 All caught up!</p>
              <p className="cte-empty-subtitle">No assignments due soon</p>
            </div>
          )}

          {!loading && !error && assignments.length > 0 && (
            <ul className="cte-assignment-list">
              {assignments.map(assignment => (
                <li key={assignment.assignmentID} className="cte-assignment-item">
                  <a href={assignment.htmlUrl} className="cte-assignment-link">
                    <div className="cte-assignment-header">
                      <span className="cte-assignment-title">{assignment.title}</span>
                      <span
                        className={`cte-assignment-time ${getTimeBadgeClass(assignment.estimatedMinutes)}`}
                      >
                        {formatTime(assignment.estimatedMinutes)}
                      </span>
                    </div>
                    <div className="cte-assignment-meta">
                      <span className="cte-assignment-course">{assignment.courseName}</span>
                      {assignment.dueDate && (
                        <span className="cte-assignment-due">
                          {formatDueDate(assignment.dueDate)}
                        </span>
                      )}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
