import React from 'react';
import { AssignmentCard } from './AssignmentCard';
import type { Assignment } from '../../types';

interface AssignmentListProps {
  assignments: Assignment[];
}

export function AssignmentList({ assignments }: AssignmentListProps) {
  // Group assignments by due date
  const groupedAssignments = groupByDate(assignments);

  return (
    <div className="space-y-4">
      {Object.entries(groupedAssignments).map(([dateLabel, items]) => (
        <div key={dateLabel} className="animate-slide-up">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-1">
            {dateLabel}
          </h3>
          <div className="space-y-2">
            {items.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupByDate(assignments: Assignment[]): Record<string, Assignment[]> {
  const groups: Record<string, Assignment[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Sort by due date
  const sorted = [...assignments].sort((a, b) => {
    const dateA = new Date(a.dueDate).getTime();
    const dateB = new Date(b.dueDate).getTime();
    return dateA - dateB;
  });

  for (const assignment of sorted) {
    const dueDate = new Date(assignment.dueDate);
    let label: string;

    if (dueDate < today) {
      label = '⚠️ Overdue';
    } else if (dueDate < tomorrow) {
      label = 'Today';
    } else if (dueDate < new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)) {
      label = 'Tomorrow';
    } else if (dueDate < nextWeek) {
      label = 'This Week';
    } else {
      label = 'Later';
    }

    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(assignment);
  }

  return groups;
}
