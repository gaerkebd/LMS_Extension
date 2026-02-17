import React from 'react';
import type { Assignment } from '../../types';

interface AssignmentCardProps {
  assignment: Assignment;
}

export function AssignmentCard({ assignment }: AssignmentCardProps) {
  const formatTime = (minutes: number | null): string => {
    if (!minutes) return '—';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatDueDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 0) return 'Overdue';
    if (diffHours < 24) {
      const hours = diffHours;
      return `Due in ${hours}h`;
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      assignment: '📝',
      quiz: '❓',
      discussion: '💬',
      essay: '📄',
      project: '🎯',
      exam: '📋',
      page: '📖',
      event: '📅',
    };
    return icons[type] || '📝';
  };

  const getTimeBadgeClass = (minutes: number | null): string => {
    if (!minutes) return 'badge bg-gray-100 text-gray-600';
    if (minutes < 60) return 'badge badge-low';
    if (minutes < 180) return 'badge badge-medium';
    return 'badge badge-high';
  };

  const handleClick = () => {
    if (assignment.htmlUrl) {
      chrome.tabs.create({ url: assignment.htmlUrl });
    }
  };

  return (
    <div
      onClick={handleClick}
      className="card p-3 cursor-pointer hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <span className="text-lg mt-0.5">{getTypeIcon(assignment.type)}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-800 truncate group-hover:text-canvas-red transition-colors">
            {assignment.title}
          </h4>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {assignment.courseName}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatDueDate(assignment.dueDate)}
          </p>
        </div>

        {/* Time estimate badge */}
        <div className={getTimeBadgeClass(assignment.estimatedMinutes)}>
          <span className="text-xs mr-1">⏱️</span>
          {formatTime(assignment.estimatedMinutes)}
        </div>
      </div>

      {/* Points indicator */}
      {assignment.pointsPossible > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
          <span>{assignment.pointsPossible} pts</span>
          {assignment.estimationConfidence && (
            <span className="capitalize">
              {assignment.estimationConfidence} confidence
            </span>
          )}
        </div>
      )}
    </div>
  );
}
