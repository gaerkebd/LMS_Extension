import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { AssignmentList } from './components/AssignmentList';
import { WeeklySummary } from './components/WeeklySummary';
import { EmptyState } from './components/EmptyState';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';
import type { Assignment, AssignmentResponse } from '../types';

type ViewState = 'loading' | 'empty' | 'error' | 'configured' | 'unconfigured';

export function Popup() {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAssignments();
  }, []);

  async function loadAssignments() {
    setViewState('loading');
    setError(null);

    try {
      // Check if configured
      const settings = await chrome.storage.sync.get(['canvasUrl', 'apiToken']);

      if (!settings.canvasUrl || !settings.apiToken) {
        setViewState('unconfigured');
        return;
      }

      // Get assignments from background script
      const response: AssignmentResponse = await chrome.runtime.sendMessage({
        type: 'GET_ASSIGNMENTS'
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.assignments || response.assignments.length === 0) {
        setViewState('empty');
        return;
      }

      setAssignments(response.assignments);
      setLastUpdated(response.lastUpdated || Date.now());
      setViewState('configured');
    } catch (err) {
      console.error('Failed to load assignments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
      setViewState('error');
    }
  }

  async function handleRefresh() {
    setViewState('loading');

    try {
      await chrome.runtime.sendMessage({ type: 'REFRESH_ASSIGNMENTS' });
      await loadAssignments();
    } catch (err) {
      console.error('Failed to refresh:', err);
      setError('Failed to refresh assignments');
      setViewState('error');
    }
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  // Calculate weekly totals
  const totalMinutes = assignments.reduce((sum, a) => sum + (a.estimatedMinutes || 0), 0);
  const assignmentCount = assignments.length;

  return (
    <div className="w-[380px] min-h-[400px] max-h-[600px] flex flex-col bg-gray-50">
      <Header
        onRefresh={handleRefresh}
        onSettings={openOptions}
        lastUpdated={lastUpdated}
      />

      <main className="flex-1 overflow-y-auto p-4">
        {viewState === 'loading' && <LoadingState />}

        {viewState === 'unconfigured' && (
          <EmptyState
            icon="⚙️"
            title="Setup Required"
            description="Connect your Canvas account to get started."
            actionLabel="Open Settings"
            onAction={openOptions}
          />
        )}

        {viewState === 'empty' && (
          <EmptyState
            icon="🎉"
            title="All Caught Up!"
            description="No assignments due in the next 2 weeks."
          />
        )}

        {viewState === 'error' && (
          <ErrorState
            message={error || 'Something went wrong'}
            onRetry={loadAssignments}
          />
        )}

        {viewState === 'configured' && (
          <>
            <WeeklySummary
              totalMinutes={totalMinutes}
              assignmentCount={assignmentCount}
            />
            <AssignmentList assignments={assignments} />
          </>
        )}
      </main>

      <footer className="px-4 py-2 text-center text-xs text-gray-400 border-t border-gray-100">
        Canvas Time Estimator v1.0.0
      </footer>
    </div>
  );
}
