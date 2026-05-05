import React, { useState } from 'react';
import type { Assignment, CalendarStudyBlock } from '../../types';

interface CalendarScheduleProps {
  assignments: Assignment[];
}

export function CalendarSchedule({ assignments }: CalendarScheduleProps) {
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState<CalendarStudyBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleAutoSchedule() {
    setScheduling(true);
    setError(null);

    try {
      const result = await chrome.runtime.sendMessage({ type: 'SYNC_CALENDAR' });

      if (result?.error) {
        throw new Error(result.error);
      }

      setScheduled(result?.blocks || []);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    }

    setScheduling(false);
  }

  if (done && scheduled.length > 0) {
    return (
      <div className="space-y-3">
        <div className="text-center py-2">
          <div className="text-2xl mb-1">&#x2705;</div>
          <p className="text-sm font-medium text-gray-800">
            {scheduled.length} study block{scheduled.length !== 1 ? 's' : ''} scheduled!
          </p>
          <p className="text-xs text-gray-500">Check your Google Calendar</p>
        </div>

        <div className="space-y-1.5">
          {scheduled.map((block, i) => {
            const start = new Date(block.startTime);
            const day = start.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
            const time = start.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
            return (
              <div key={i} className="bg-white rounded-lg p-2 border border-gray-200 flex justify-between items-center">
                <div>
                  <p className="text-xs font-medium text-gray-800 truncate">{block.assignmentTitle}</p>
                  <p className="text-[10px] text-gray-500">{day} at {time}</p>
                </div>
                <span className="text-xs text-gray-500">{block.durationMinutes}m</span>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => { setDone(false); setScheduled([]); }}
          className="w-full text-xs text-gray-500 hover:text-gray-700 py-1"
        >
          Schedule again
        </button>
      </div>
    );
  }

  const schedulableCount = assignments.filter(a => a.dueDate && a.estimatedMinutes).length;

  return (
    <div className="text-center py-6 px-4">
      <div className="text-3xl mb-2">&#x1F4C5;</div>
      <h3 className="text-sm font-semibold text-gray-800 mb-1">Auto-Schedule Study Time</h3>
      <p className="text-xs text-gray-500 mb-4">
        Automatically create study blocks on your Google Calendar based on your upcoming assignments and estimated times.
      </p>

      {schedulableCount > 0 ? (
        <p className="text-xs text-gray-600 mb-3">
          {schedulableCount} assignment{schedulableCount !== 1 ? 's' : ''} ready to schedule
        </p>
      ) : (
        <p className="text-xs text-gray-500 mb-3">
          No assignments with time estimates to schedule.
        </p>
      )}

      <button
        onClick={handleAutoSchedule}
        disabled={scheduling || schedulableCount === 0}
        className="px-4 py-2 bg-canvas-purple text-white text-sm font-medium rounded-lg hover:bg-[#5a6fd6] transition-colors disabled:opacity-50"
      >
        {scheduling ? 'Scheduling...' : 'Schedule Study Blocks'}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}

      <p className="mt-3 text-[10px] text-gray-400">
        Schedules between 8 AM - 10 PM, avoids existing events. Blocks are 60 min max.
      </p>
    </div>
  );
}
