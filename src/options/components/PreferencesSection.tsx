import React from 'react';
import type { Settings } from '../../types';

interface PreferencesSectionProps {
  showNotifications: boolean;
  injectBadges: boolean;
  refreshInterval: number;
  lookaheadDays: number;
  onChange: (updates: Partial<Settings>) => void;
}

export function PreferencesSection({
  showNotifications,
  injectBadges,
  refreshInterval,
  lookaheadDays,
  onChange,
}: PreferencesSectionProps) {
  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        Preferences
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Customize how the extension behaves.
      </p>

      <div className="space-y-4">
        {/* Checkboxes */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showNotifications}
              onChange={(e) => onChange({ showNotifications: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-canvas-red focus:ring-canvas-red"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Show notifications for urgent assignments
              </span>
              <p className="text-xs text-gray-500">
                Get notified when assignments are due within 24 hours
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={injectBadges}
              onChange={(e) => onChange({ injectBadges: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-canvas-red focus:ring-canvas-red"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Show time badges on Canvas pages
              </span>
              <p className="text-xs text-gray-500">
                Inject time estimate badges directly into the Canvas interface
              </p>
            </div>
          </label>
        </div>

        {/* Refresh Interval */}
        <div>
          <label htmlFor="refresh-interval" className="block text-sm font-medium text-gray-700 mb-1">
            Auto-refresh Interval
          </label>
          <select
            id="refresh-interval"
            value={refreshInterval}
            onChange={(e) => onChange({ refreshInterval: parseInt(e.target.value) })}
            className="input"
          >
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every hour</option>
            <option value={120}>Every 2 hours</option>
          </select>
        </div>

        {/* Lookahead Days */}
        <div>
          <label htmlFor="lookahead-days" className="block text-sm font-medium text-gray-700 mb-1">
            Show Assignments Due Within
          </label>
          <select
            id="lookahead-days"
            value={lookaheadDays}
            onChange={(e) => onChange({ lookaheadDays: parseInt(e.target.value) })}
            className="input"
          >
            <option value={7}>1 week</option>
            <option value={14}>2 weeks</option>
            <option value={21}>3 weeks</option>
            <option value={30}>1 month</option>
          </select>
        </div>
      </div>
    </section>
  );
}
