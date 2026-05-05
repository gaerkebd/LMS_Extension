import React from 'react';

export type PopupTab = 'assignments' | 'analytics' | 'calendar';

interface TabBarProps {
  activeTab: PopupTab;
  onTabChange: (tab: PopupTab) => void;
  isPremium: boolean;
}

export function TabBar({ activeTab, onTabChange, isPremium }: TabBarProps) {
  const tabs: { id: PopupTab; label: string; locked: boolean }[] = [
    { id: 'assignments', label: 'Assignments', locked: false },
    { id: 'analytics', label: 'Analytics', locked: !isPremium },
    { id: 'calendar', label: 'Calendar', locked: !isPremium },
  ];

  return (
    <div className="flex border-b border-gray-200 bg-white">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 py-2 text-xs font-medium text-center transition-colors relative ${
            activeTab === tab.id
              ? 'text-canvas-purple border-b-2 border-canvas-purple'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
          {tab.locked && (
            <span className="ml-1 text-gray-400" title="Premium feature">
              &#x1F512;
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
