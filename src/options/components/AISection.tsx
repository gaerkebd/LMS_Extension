import React, { useState } from 'react';
import type { Settings } from '../../types';

interface AISectionProps {
  provider: Settings['aiProvider'];
  openaiKey: string;
  anthropicKey: string;
  localLlmUrl: string;
  localLlmModel: string;
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
  LocalLLM: [
    { value: 'qwen2.5-coder:1.5b', label: 'Qwen2.5 Coder 1.5B (Fast & Efficient)', recommended: true },
    { value: 'llama3:8b', label: 'Llama 3 8B (More capable)' },
  ]
};

export function AISection({ provider, openaiKey, anthropicKey, localLlmUrl, localLlmModel, model, onChange }: AISectionProps) {
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const currentModels = provider === 'openai' ? MODELS.openai : provider === 'anthropic' ? MODELS.anthropic : provider === 'local' ? MODELS.LocalLLM : [];

  const testOllamaConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    try {
      const url = localLlmUrl || 'http://localhost:11434';
      const response = await fetch(`${url}`);
      if (response.ok) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
      }
    } catch {
      setConnectionStatus('error');
    }
    setTestingConnection(false);
  };

  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        AI Time Estimation
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Configure AI-powered time estimation. Without an API key, heuristic estimation or Local LLM will be options.
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
            <option value="local">LocalLLM (Ollama)</option>
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

        {/* Info about heuristics */}
        {provider === 'none' && (
          <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <strong>💡 Heuristic Mode:</strong> Time estimates will be calculated based on assignment type,
            points, and title keywords. For more accurate estimates, configure an AI provider.
          </div>
        )}
        
        {provider === 'local' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="local-llm-url" className="block text-sm font-medium text-gray-700 mb-1">
                Ollama Server URL
              </label>
              <input
                type="text"
                id="local-llm-url"
                value={localLlmUrl}
                onChange={(e) => onChange({ localLlmUrl: e.target.value })}
                placeholder="http://localhost:11434/api/generate"
                className="input"
              />
              <p className="mt-1 text-xs text-gray-500">
                Default is http://localhost:11434/api/generate. For a remote PC, use its IP address (e.g., http://192.168.1.100:11434)
              </p>
            </div>

            <div>
              <label htmlFor="local-llm-model" className="block text-sm font-medium text-gray-700 mb-1">
                Model Name
              </label>
              <input
                type="text"
                id="local-llm-model"
                value={localLlmModel}
                onChange={(e) => onChange({ localLlmModel: e.target.value })}
                placeholder="llama3:8b"
                className="input"
              />
              <p className="mt-1 text-xs text-gray-500">
                The model name as shown in <code className="bg-gray-100 px-1 rounded">ollama list</code>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={testOllamaConnection}
                disabled={testingConnection}
                className="btn-secondary text-sm"
              >
                {testingConnection ? 'Testing...' : 'Test Connection'}
              </button>
              {connectionStatus === 'success' && (
                <span className="text-green-600 text-sm">Connected successfully!</span>
              )}
              {connectionStatus === 'error' && (
                <span className="text-red-600 text-sm">Connection failed. Is Ollama running?</span>
              )}
            </div>

            <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
              <strong>Setup Instructions:</strong>
              <ol className="list-decimal ml-4 mt-1 space-y-1">
                <li>Install Ollama from <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="underline">ollama.ai</a></li>
                <li>Run: <code className="bg-amber-100 px-1 rounded">ollama pull qwen2.5-coder:1.5b</code></li>
                <li>Start server: <code className="bg-amber-100 px-1 rounded">ollama serve</code></li>
                <li>For network access: <code className="bg-amber-100 px-1 rounded">OLLAMA_HOST=0.0.0.0 ollama serve</code></li>
              </ol>
            </div>
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
      </div>
    </section>
  );
}
