import React, { useEffect, useState } from 'react';
import type { AnalyticsEntry } from '../../types';

interface Summary {
  totalMinutes: number;
  totalAssignments: number;
  avgMinutesPerDay: number;
  byCourse: { courseName: string; minutes: number; count: number }[];
  trend: 'increasing' | 'decreasing' | 'stable';
}

export function AnalyticsDashboard() {
  const [history, setHistory] = useState<AnalyticsEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_ANALYTICS' });
      if (res?.history) setHistory(res.history);
      if (res?.summary) setSummary(res.summary);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
    setLoading(false);
  }

  if (loading) {
    return <div className="text-center py-8 text-sm text-gray-500">Loading analytics...</div>;
  }

  if (!summary || history.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        Not enough data yet. Analytics will appear after a few days of use.
      </div>
    );
  }

  const trendIcon = summary.trend === 'increasing' ? '&#x2191;' : summary.trend === 'decreasing' ? '&#x2193;' : '&#x2192;';
  const trendColor = summary.trend === 'increasing' ? 'text-red-500' : summary.trend === 'decreasing' ? 'text-green-500' : 'text-gray-500';

  const maxCourseMinutes = Math.max(...summary.byCourse.map(c => c.minutes), 1);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-lg p-2 text-center border border-gray-200">
          <div className="text-lg font-bold text-gray-800">
            {Math.round(summary.totalMinutes / 60)}h
          </div>
          <div className="text-xs text-gray-500">Total (14d)</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center border border-gray-200">
          <div className="text-lg font-bold text-gray-800">
            {summary.totalAssignments}
          </div>
          <div className="text-xs text-gray-500">Assignments</div>
        </div>
        <div className="bg-white rounded-lg p-2 text-center border border-gray-200">
          <div className={`text-lg font-bold ${trendColor}`} dangerouslySetInnerHTML={{ __html: trendIcon }} />
          <div className="text-xs text-gray-500">Trend</div>
        </div>
      </div>

      {/* Daily Workload Bar Chart (last 7 days) */}
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <h3 className="text-xs font-semibold text-gray-700 mb-2">Daily Workload (hours)</h3>
        <div className="flex items-end gap-1 h-20">
          {history.slice(-7).map((entry, i) => {
            const hours = entry.totalMinutes / 60;
            const maxH = Math.max(...history.slice(-7).map(e => e.totalMinutes / 60), 1);
            const pct = (hours / maxH) * 100;
            const day = new Date(entry.date).toLocaleDateString('en', { weekday: 'short' });
            return (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="w-full relative" style={{ height: '60px' }}>
                  <div
                    className="absolute bottom-0 w-full bg-canvas-red/80 rounded-t"
                    style={{ height: `${Math.max(pct, 4)}%` }}
                    title={`${hours.toFixed(1)}h`}
                  />
                </div>
                <span className="text-[9px] text-gray-400 mt-1">{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Course Breakdown */}
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <h3 className="text-xs font-semibold text-gray-700 mb-2">By Course</h3>
        <div className="space-y-2">
          {summary.byCourse.slice(0, 5).map((course, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-700 truncate mr-2">{course.courseName}</span>
                <span className="text-gray-500 whitespace-nowrap">
                  {Math.round(course.minutes / 60)}h ({course.count})
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-canvas-red/70 rounded-full"
                  style={{ width: `${(course.minutes / maxCourseMinutes) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
