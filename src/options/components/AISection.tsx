import React, { useState } from 'react';
import type { Settings } from '../../types';

interface AISectionProps {
  provider: Settings['aiProvider'];
  openaiKey: string;
  anthropicKey: string;
  model: string;
  onChange: (updates: Partial<Settings>) => void;
}

const MODELS = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Cheap)', recommended: true },
    { value: 'gpt-4o', label: 'GPT-4o (More accurate)' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Legacy)' },
  ],
  anthropic: [
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Fast & Cheap)', recommended: true },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Balanced)' },
  ],
};

export function AISection({ provider, openaiKey, anthropicKey, model, onChange }: AISectionProps) {
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);

  const currentModels = provider === 'openai' ? MODELS.openai : provider === 'anthropic' ? MODELS.anthropic : [];

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        AI Time Estimation
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Configure AI-powered time estimation. Without an API key, heuristic estimation will be used.
      </p>

      <div className="space-y-4">
        {/* Provider Selection */}
        <div>
          <label htmlFor="ai-provider" className="block text-sm font-medium text-gray-700 mb-1">
            AI Provider
          </label>
          <select
            id="ai-provider"
            value={provider}
            onChange={(e) => onChange({ aiProvider: e.target.value as Settings['aiProvider'] })}
            className="input"
          >
            <option value="none">None (Use heuristics only)</option>
            <option value="openai">OpenAI (GPT)</option>
            <option value="anthropic">Anthropic (Claude)</option>
          </select>
        </div>

        {/* OpenAI API Key */}
        {provider === 'openai' && (
          <div>
            <label htmlFor="openai-key" className="block text-sm font-medium text-gray-700 mb-1">
              OpenAI API Key
            </label>
            <div className="relative">
              <input
                type={showOpenAIKey ? 'text' : 'password'}
                id="openai-key"
                value={openaiKey}
                onChange={(e) => onChange({ openaiApiKey: e.target.value })}
                placeholder="sk-..."
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                {showOpenAIKey ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Get your API key from{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-canvas-red hover:underline"
              >
                OpenAI
              </a>
            </p>
          </div>
        )}

        {/* Anthropic API Key */}
        {provider === 'anthropic' && (
          <div>
            <label htmlFor="anthropic-key" className="block text-sm font-medium text-gray-700 mb-1">
              Anthropic API Key
            </label>
            <div className="relative">
              <input
                type={showAnthropicKey ? 'text' : 'password'}
                id="anthropic-key"
                value={anthropicKey}
                onChange={(e) => onChange({ anthropicApiKey: e.target.value })}
                placeholder="sk-ant-..."
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                {showAnthropicKey ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Get your API key from{' '}
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-canvas-red hover:underline"
              >
                Anthropic Console
              </a>
            </p>
          </div>
        )}

        {/* Model Selection */}
        {provider !== 'none' && currentModels.length > 0 && (
          <div>
            <label htmlFor="ai-model" className="block text-sm font-medium text-gray-700 mb-1">
              Model
            </label>
            <select
              id="ai-model"
              value={model}
              onChange={(e) => onChange({ estimationModel: e.target.value })}
              className="input"
            >
              {currentModels.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                  {m.recommended ? ' ⭐' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Info about heuristics */}
        {provider === 'none' && (
          <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <strong>💡 Heuristic Mode:</strong> Time estimates will be calculated based on assignment type,
            points, and title keywords. For more accurate estimates, configure an AI provider.
          </div>
        )}
      </div>
    </section>
  );
}
