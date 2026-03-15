import React, { useEffect, useState } from 'react';
import type { Assignment, AssignmentResponse } from '../types';

export function CanvasSidebar() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    loadAssignments();
  }, []);

  async function loadAssignments() {
    setLoading(true);
    setError(null);

    try {
      const settings = await chrome.storage.sync.get(['canvasUrl', 'apiToken']);

      if (!settings.canvasUrl || !settings.apiToken) {
        setError('Extension not configured');
        setLoading(false);
        return;
      }

      const response: AssignmentResponse = await chrome.runtime.sendMessage({
        type: 'GET_ASSIGNMENTS'
      });

      if (response.error) {
        throw new Error(response.error);
      }

      setAssignments(response.assignments || []);
    } catch (err) {
      console.error('Failed to load assignments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    try {
      await chrome.runtime.sendMessage({ type: 'REFRESH_ASSIGNMENTS' });
      await loadAssignments();
    } catch (err) {
      console.error('Failed to refresh:', err);
      setError('Failed to refresh');
    }
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  function formatTime(minutes: number | null): string {
    if (!minutes) return '?';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  function formatDueDate(dueDate: string): string {
    const date = new Date(dueDate);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `${diffDays} days`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const totalMinutes = assignments.reduce((sum, a) => sum + (a.estimatedMinutes || 0), 0);

  // Helper to get time badge class
  function getTimeBadgeClass(minutes: number | null): string {
    if (!minutes) return '';
    if (minutes >= 180) return 'high';
    if (minutes >= 90) return 'medium';
    return '';
  }

  return (
    <div className="canvas-time-estimator-sidebar">
      <div className="cte-header">
        <h2 className="cte-title">
          <span className="cte-icon">⏱️</span>
          Time Estimates
        </h2>
        <div className="cte-actions">
          <button
            onClick={handleRefresh}
            className="cte-btn-icon"
            title="Refresh"
            disabled={loading}
          >
            🔄
          </button>
          <button
            onClick={openOptions}
            className="cte-btn-icon"
            title="Settings"
          >
            ⚙️
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="cte-btn-icon"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="cte-content">
          {/* Summary always at top */}
          <div className="cte-summary">
            <div className="cte-summary-item">
              <span className="cte-summary-value">
                {loading ? '...' : assignments.length}
              </span>
              <span className="cte-summary-label">Assignments</span>
            </div>
            <div className="cte-summary-item">
              <span className="cte-summary-value">
                {loading ? '...' : formatTime(totalMinutes)}
              </span>
              <span className="cte-summary-label">Total Time</span>
            </div>
          </div>

          {/* Content states below summary */}
          {loading && (
            <div className="cte-loading">
              <div className="cte-spinner"></div>
              <p>Loading assignments...</p>
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
              {assignments.map((assignment, idx) => (
                <li key={idx} className="cte-assignment-item">
                  <a href={assignment.htmlUrl} className="cte-assignment-link">
                    <div className="cte-assignment-header">
                      <span className="cte-assignment-title">{assignment.title}</span>
                      <span className={`cte-assignment-time ${getTimeBadgeClass(assignment.estimatedMinutes)}`}>
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