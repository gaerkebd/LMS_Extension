import React, { useState } from 'react';
import type { Settings } from '../../types';

interface CanvasSectionProps {
  canvasUrl: string;
  apiToken: string;
  onChange: (updates: Partial<Settings>) => void;
}

export function CanvasSection({ canvasUrl, apiToken, onChange }: CanvasSectionProps) {
  const [showToken, setShowToken] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [showHelp, setShowHelp] = useState(false);

  async function testConnection() {
    if (!canvasUrl || !apiToken) {
      setConnectionStatus('error');
      return;
    }

    setConnectionStatus('testing');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_CONNECTION',
        url: canvasUrl,
        token: apiToken,
      });

      setConnectionStatus(response.success ? 'success' : 'error');
    } catch {
      setConnectionStatus('error');
    }
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        Canvas Connection
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Connect to your Canvas LMS instance to fetch assignments.
      </p>

      <div className="space-y-4">
        {/* Canvas URL */}
        <div>
          <label htmlFor="canvas-url" className="block text-sm font-medium text-gray-700 mb-1">
            Canvas URL
          </label>
          <input
            type="url"
            id="canvas-url"
            value={canvasUrl}
            onChange={(e) => onChange({ canvasUrl: e.target.value })}
            placeholder="https://yourschool.instructure.com"
            className="input"
          />
          <p className="mt-1 text-xs text-gray-500">
            Your school's Canvas URL (e.g., https://canvas.university.edu)
          </p>
        </div>

        {/* API Token */}
        <div>
          <label htmlFor="api-token" className="block text-sm font-medium text-gray-700 mb-1">
            API Access Token
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              id="api-token"
              value={apiToken}
              onChange={(e) => onChange({ apiToken: e.target.value })}
              placeholder="Enter your Canvas API token"
              className="input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              {showToken ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="text-canvas-red hover:underline"
            >
              How do I get an API token?
            </button>
          </p>
        </div>

        {/* Test Connection Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={testConnection}
            disabled={connectionStatus === 'testing'}
            className="btn btn-secondary"
          >
            {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </button>

          {connectionStatus === 'success' && (
            <span className="text-sm text-green-600">✓ Connected successfully!</span>
          )}
          {connectionStatus === 'error' && (
            <span className="text-sm text-red-600">✗ Connection failed</span>
          )}
        </div>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">How to Get Your Canvas API Token</h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 mb-4">
              <li>Log in to your Canvas account</li>
              <li>Click on <strong>Account</strong> in the left sidebar</li>
              <li>Click on <strong>Settings</strong></li>
              <li>Scroll down to <strong>Approved Integrations</strong></li>
              <li>Click <strong>+ New Access Token</strong></li>
              <li>Enter a purpose (e.g., "Time Estimator Extension")</li>
              <li>Click <strong>Generate Token</strong></li>
              <li>Copy the token and paste it above</li>
            </ol>

            <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
              <strong>⚠️ Important:</strong> Keep your token secret! It provides access to your Canvas account.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
