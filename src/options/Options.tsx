import React, { useEffect, useState } from 'react';
import { CanvasSection } from './components/CanvasSection';
import { AISection } from './components/AISection';
import { PreferencesSection } from './components/PreferencesSection';
import type { Settings } from '../types';

const DEFAULT_SETTINGS: Settings = {
  canvasUrl: '',
  apiToken: '',
  aiProvider: 'none',
  openaiApiKey: '',
  anthropicApiKey: '',
  localLlmUrl: 'http://localhost:11434',
  localLlmModel: 'llama3:8b',
  estimationModel: 'gpt-4o-mini',
  showNotifications: true,
  refreshInterval: 30,
  lookaheadDays: 14,
  injectBadges: true,
};

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
      setSettings({ ...DEFAULT_SETTINGS, ...stored });
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  function updateSettings(updates: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...updates }));
    setIsDirty(true);
    setSaveStatus('idle');
  }

  async function handleSave() {
    setSaveStatus('saving');

    try {
      await chrome.storage.sync.set(settings);

      // Update alarm interval
      await chrome.alarms.clear('refresh-assignments');
      await chrome.alarms.create('refresh-assignments', {
        periodInMinutes: settings.refreshInterval,
      });

      setSaveStatus('saved');
      setIsDirty(false);

      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
    }
  }

  async function handleReset() {
    if (!confirm('Reset all settings to defaults? API keys will be cleared.')) {
      return;
    }

    try {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
      setSettings(DEFAULT_SETTINGS);
      setIsDirty(false);
      setSaveStatus('idle');
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">⚙️</span>
            <h1 className="text-2xl font-bold text-gray-900">
              Canvas Time Estimator
            </h1>
          </div>
          <p className="text-gray-500">
            Configure your Canvas connection and AI preferences
          </p>
        </header>

        {/* Settings Sections */}
        <div className="space-y-6">
          <CanvasSection
            canvasUrl={settings.canvasUrl}
            apiToken={settings.apiToken}
            onChange={updateSettings}
          />

          <AISection
            provider={settings.aiProvider}
            openaiKey={settings.openaiApiKey || ''}
            anthropicKey={settings.anthropicApiKey || ''}
            localLlmUrl={settings.localLlmUrl || 'http://localhost:11434'}
            localLlmModel={settings.localLlmModel || 'llama3:8b'}
            model={settings.estimationModel}
            onChange={updateSettings}
          />

          <PreferencesSection
            showNotifications={settings.showNotifications}
            injectBadges={settings.injectBadges}
            refreshInterval={settings.refreshInterval}
            lookaheadDays={settings.lookaheadDays}
            onChange={updateSettings}
          />
        </div>

        {/* Save Button */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Reset to Defaults
          </button>

          <div className="flex items-center gap-4">
            {saveStatus === 'saved' && (
              <span className="text-sm text-green-600 animate-fade-in">
                ✓ Settings saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-red-600 animate-fade-in">
                ✗ Failed to save
              </span>
            )}

            <button
              onClick={handleSave}
              disabled={!isDirty || saveStatus === 'saving'}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-400">
          <p>Canvas Time Estimator v1.0.0</p>
        </footer>
      </div>
    </div>
  );
}
