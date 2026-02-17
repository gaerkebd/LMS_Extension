import React from 'react';

interface WeeklySummaryProps {
  totalMinutes: number;
  assignmentCount: number;
}

export function WeeklySummary({ totalMinutes, assignmentCount }: WeeklySummaryProps) {
  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getTimeColor = (minutes: number): string => {
    if (minutes < 180) return 'text-green-600'; // Under 3 hours
    if (minutes < 480) return 'text-amber-600'; // Under 8 hours
    return 'text-red-600'; // 8+ hours
  };

  return (
    <div className="card p-4 mb-4 animate-fade-in">
      <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
        This Week
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className={`text-2xl font-bold ${getTimeColor(totalMinutes)}`}>
            {formatTime(totalMinutes)}
          </p>
          <p className="text-xs text-gray-500">Total estimated time</p>
        </div>

        <div>
          <p className="text-2xl font-bold text-gray-800">
            {assignmentCount}
          </p>
          <p className="text-xs text-gray-500">
            Assignment{assignmentCount !== 1 ? 's' : ''} due
          </p>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Workload</span>
          <span>{Math.round(totalMinutes / 60)} hours</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              totalMinutes < 180
                ? 'bg-green-500'
                : totalMinutes < 480
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            style={{
              width: `${Math.min((totalMinutes / 600) * 100, 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
