import React, { useState, useEffect } from 'react';

interface LogEntry {
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'request' | 'response';
  message: string;
  data?: unknown;
}

interface TestResult {
  assignment: {
    title: string;
    type: string;
    courseName: string;
    pointsPossible?: number;
  };
  prompt: string;
  response: unknown;
  estimatedMinutes: number;
  method: string;
  duration: number;
}

export function DebugPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [cachedAssignments, setCachedAssignments] = useState<unknown[]>([]);
  const [totalTestTime, setTotalTestTime] = useState<number | null>(null);
  const [testProgress, setTestProgress] = useState<{ current: number; total: number } | null>(null);

  const addLog = (type: LogEntry['type'], message: string, data?: unknown) => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toISOString().split('T')[1].split('.')[0],
      type,
      message,
      data
    }]);
  };

  useEffect(() => {
    loadSettings();
    checkOllamaConnection();
    loadCachedAssignments();
  }, []);

  async function loadSettings() {
    try {
      const stored = await chrome.storage.sync.get(null);
      setSettings(stored);
      addLog('info', 'Settings loaded', stored);
    } catch (error) {
      addLog('error', 'Failed to load settings', error);
    }
  }

  async function loadCachedAssignments() {
    try {
      const cached = await chrome.storage.local.get(['cachedAssignments', 'lastUpdated']);
      if (cached.cachedAssignments) {
        setCachedAssignments(cached.cachedAssignments);
        addLog('info', `Loaded ${cached.cachedAssignments.length} cached assignments`, {
          lastUpdated: cached.lastUpdated ? new Date(cached.lastUpdated).toLocaleString() : 'never'
        });
      } else {
        addLog('info', 'No cached assignments found');
      }
    } catch (error) {
      addLog('error', 'Failed to load cached assignments', error);
    }
  }

  async function checkOllamaConnection() {
    const url = (settings.localLlmUrl as string) || 'http://localhost:11434';
    addLog('request', `Testing Ollama at ${url}/api/tags`);

    try {
      const response = await fetch(`${url}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        setOllamaStatus('connected');
        addLog('success', 'Ollama connected', data);
      } else {
        setOllamaStatus('error');
        addLog('error', `Ollama returned ${response.status}`);
      }
    } catch (error) {
      setOllamaStatus('error');
      addLog('error', 'Ollama connection failed', String(error));
    }
  }

  async function testSingleEstimation() {
    setIsRunning(true);
    addLog('info', 'Starting single assignment test...');

    const testAssignment = {
      title: 'Test Quiz - Chapter 5 Review',
      type: 'quiz',
      courseName: 'Introduction to Computer Science',
      pointsPossible: 25,
      submissionTypes: ['online_quiz'],
      description: '<p>This quiz covers chapter 5 material including arrays, loops, and basic algorithms.</p>'
    };

    try {
      const startTime = Date.now();

      // Build the prompt manually to show it
      const prompt = buildPrompt(testAssignment);
      addLog('request', 'Sending to Ollama', { prompt: prompt.substring(0, 200) + '...' });

      const url = (settings.localLlmUrl as string) || 'http://localhost:11434';
      const model = (settings.localLlmModel as string) || 'qwen2.5-coder:1.5b';

      // Log the exact curl command for debugging
      const curlCommand = `curl ${url}/api/generate -d '${JSON.stringify({
        model,
        prompt,
        stream: false,
      })}'`;
      addLog('info', 'Equivalent curl command', curlCommand);

      const response = await fetch(`${url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
        })
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        addLog('error', `Ollama error: ${response.status}`, errorText);
        setIsRunning(false);
        return;
      }

      const data = await response.json();
      addLog('response', 'Ollama raw response', data);

      // Parse the LLM's text response to extract JSON
      const llmResponse = data.response || '';
      addLog('info', 'LLM text response', llmResponse);

      // Parse the response to get {"minutes": X, "reasoning": "..."}
      const parsed = parseOllamaResponse(llmResponse);
      addLog('success', `Parsed result: ${JSON.stringify(parsed)}`);

      const testResult: TestResult = {
        assignment: testAssignment,
        prompt,
        response: llmResponse,
        estimatedMinutes: parsed.minutes,
        method: parsed.method,
        duration
      };

      setTestResults(prev => [...prev, testResult]);
      addLog('success', `Estimation complete: ${parsed.minutes} minutes (${parsed.method}) in ${duration}ms`);

    } catch (error) {
      addLog('error', 'Test failed', String(error));
    }

    setIsRunning(false);
  }

  // Helper function to parse Ollama response and extract JSON
  function parseOllamaResponse(response: string): { minutes: number; reasoning: string; method: string } {
    // Try to find JSON object in the response
    const jsonMatch = response.match(/\{[^{}]*"minutes"\s*:\s*(\d+)[^{}]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          minutes: typeof parsed.minutes === 'number' ? parsed.minutes : parseInt(parsed.minutes),
          reasoning: parsed.reasoning || '',
          method: 'json_parsed'
        };
      } catch {
        // JSON parse failed, continue to regex
      }
    }

    // Try regex to extract minutes
    const minutesMatch = response.match(/"minutes"\s*:\s*(\d+)/);
    if (minutesMatch) {
      return {
        minutes: parseInt(minutesMatch[1]),
        reasoning: response,
        method: 'regex_minutes_field'
      };
    }

    // Try to find any number followed by "minutes"
    const numMatch = response.match(/(\d+)\s*minutes?/i);
    if (numMatch) {
      return {
        minutes: parseInt(numMatch[1]),
        reasoning: response,
        method: 'regex_extracted'
      };
    }

    // Fallback
    return {
      minutes: 60,
      reasoning: 'Could not parse response',
      method: 'fallback'
    };
  }

  async function testWithCachedAssignments() {
    if (cachedAssignments.length === 0) {
      addLog('error', 'No cached assignments to test with');
      return;
    }

    setIsRunning(true);
    addLog('info', `Testing ${Math.min(cachedAssignments.length, 3)} of ${cachedAssignments.length} cached assignments...`);

    const url = (settings.localLlmUrl as string) || 'http://localhost:11434';
    const model = (settings.localLlmModel as string) || 'qwen2.5-coder:1.5b';

    for (const assignment of cachedAssignments.slice(0, 3)) { // Test first 3
      const asn = assignment as Record<string, unknown>;
      addLog('info', `Testing: ${asn.title}`);

      try {
        const startTime = Date.now();
        const prompt = buildPrompt(asn);

        addLog('request', `Sending prompt for "${asn.title}"`, { promptLength: prompt.length });

        const response = await fetch(`${url}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt,
            stream: false,
          })
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
          const errorText = await response.text();
          addLog('error', `Ollama error for "${asn.title}": ${response.status}`, errorText);
          continue;
        }

        const data = await response.json();
        const llmResponse = data.response || '';

        addLog('response', `Raw response for "${asn.title}"`, llmResponse.substring(0, 200));

        // Parse the response
        const parsed = parseOllamaResponse(llmResponse);

        const result: TestResult = {
          assignment: {
            title: asn.title as string,
            type: asn.type as string,
            courseName: asn.courseName as string,
            pointsPossible: asn.pointsPossible as number
          },
          prompt,
          response: llmResponse,
          estimatedMinutes: parsed.minutes,
          method: parsed.method,
          duration
        };

        setTestResults(prev => [...prev, result]);
        addLog('success', `${asn.title}: ${parsed.minutes} min (${parsed.method}) in ${duration}ms`);

      } catch (error) {
        addLog('error', `Failed: ${asn.title}`, String(error));
      }
    }

    setIsRunning(false);
  }

  async function testAllAssignments() {
    if (cachedAssignments.length === 0) {
      addLog('error', 'No cached assignments to test with');
      return;
    }

    setIsRunning(true);
    setTestResults([]);
    setTestProgress({ current: 0, total: cachedAssignments.length });
    setTotalTestTime(null);

    const overallStartTime = Date.now();
    addLog('info', `Testing ALL ${cachedAssignments.length} cached assignments with qwen2.5-coder:1.5b...`);

    const url = (settings.localLlmUrl as string) || 'http://localhost:11434';
    const model = (settings.localLlmModel as string) || 'qwen2.5-coder:1.5b';

    for (let i = 0; i < cachedAssignments.length; i++) {
      const assignment = cachedAssignments[i];
      const asn = assignment as Record<string, unknown>;
      setTestProgress({ current: i + 1, total: cachedAssignments.length });
      addLog('info', `[${i + 1}/${cachedAssignments.length}] Testing: ${asn.title}`);

      try {
        const startTime = Date.now();
        const prompt = buildPrompt(asn);

        const response = await fetch(`${url}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt,
            stream: false,
          })
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
          const errorText = await response.text();
          addLog('error', `Ollama error for "${asn.title}": ${response.status}`, errorText);
          continue;
        }

        const data = await response.json();
        const llmResponse = data.response || '';

        const parsed = parseOllamaResponse(llmResponse);

        const result: TestResult = {
          assignment: {
            title: asn.title as string,
            type: asn.type as string,
            courseName: asn.courseName as string,
            pointsPossible: asn.pointsPossible as number
          },
          prompt,
          response: llmResponse,
          estimatedMinutes: parsed.minutes,
          method: parsed.method,
          duration
        };

        setTestResults(prev => [...prev, result]);
        addLog('success', `${asn.title}: ${parsed.minutes} min (${parsed.method}) in ${duration}ms`);

      } catch (error) {
        addLog('error', `Failed: ${asn.title}`, String(error));
      }
    }

    const totalTime = Date.now() - overallStartTime;
    setTotalTestTime(totalTime);
    setTestProgress(null);
    addLog('success', `All tests complete! Total time: ${(totalTime / 1000).toFixed(2)}s for ${cachedAssignments.length} assignments`);
    setIsRunning(false);
  }

  async function clearCacheAndRefresh() {
    addLog('info', 'Clearing cache...');
    await chrome.storage.local.remove(['cachedAssignments', 'lastUpdated']);
    addLog('info', 'Sending REFRESH_ASSIGNMENTS message...');

    try {
      const response = await chrome.runtime.sendMessage({ type: 'REFRESH_ASSIGNMENTS' });
      addLog('success', 'Refresh complete', response);
      await loadCachedAssignments();
    } catch (error) {
      addLog('error', 'Refresh failed', error);
    }
  }

  function buildPrompt(assignment: Record<string, unknown>): string {
    const details = [
      `Title: ${assignment.title}`,
      `Type: ${assignment.type}`,
      `Course: ${assignment.courseName}`,
      typeof assignment.pointsPossible === 'number' ? `Points: ${assignment.pointsPossible}` : null,
      Array.isArray(assignment.submissionTypes) && assignment.submissionTypes.length
        ? `Submission types: ${assignment.submissionTypes.join(', ')}`
        : null,
      assignment.description
        ? `Description snippet: ${String(assignment.description).replace(/<[^>]*>/g, ' ').substring(0, 500)}`
        : null
    ].filter(Boolean).join('\n');

    const largePrompt = `You are an academic workload estimator. Based on the following assignment details, estimate how many minutes it would take an average student to complete this assignment.

            Assignment Details:
            ${details}

            Consider factors like:
            - Type of assignment (quiz, essay, project, discussion, etc.)
            - Complexity indicated by points
            - Submission type requirements
            - Subject matter complexity

            Respond with ONLY a JSON object in this exact format:
            {"minutes": <number>, "reasoning": "<brief explanation>"}

            Be realistic - most assignments take between 30 minutes and 4 hours. Only estimate longer for major projects or papers.`;
    const smallTestPrompt_8b = `Give time minutes estimation to complete:Course: Intro to AI, Description: Solve the 7 queens problem in chess in python.`;
    const smallTestPrompt = `Random minutes 30-100 please`;
    return smallTestPrompt;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Canvas Time Estimator - Debug Panel</h1>

        {/* Status Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm text-gray-400 mb-1">AI Provider</h3>
            <p className="text-lg font-semibold">{String(settings.aiProvider) || 'not set'}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm text-gray-400 mb-1">Ollama Status</h3>
            <p className={`text-lg font-semibold ${ollamaStatus === 'connected' ? 'text-green-400' : ollamaStatus === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
              {ollamaStatus}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm text-gray-400 mb-1">Cached Assignments</h3>
            <p className="text-lg font-semibold">{cachedAssignments.length}</p>
          </div>
        </div>

        {/* Settings Display */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Current Settings</h2>
          <pre className="text-xs bg-gray-900 p-3 rounded overflow-auto max-h-40">
            {JSON.stringify(settings, null, 2)}
          </pre>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={testSingleEstimation}
            disabled={isRunning}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-medium"
          >
            {isRunning ? 'Running...' : 'Test Single Assignment'}
          </button>
          <button
            onClick={testWithCachedAssignments}
            disabled={isRunning || cachedAssignments.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded font-medium"
          >
            Test 3 Assignments
          </button>
          <button
            onClick={testAllAssignments}
            disabled={isRunning || cachedAssignments.length === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 rounded font-medium"
          >
            {testProgress
              ? `Testing ${testProgress.current}/${testProgress.total}...`
              : 'Test All Assignments'}
          </button>
          <button
            onClick={clearCacheAndRefresh}
            disabled={isRunning}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded font-medium"
          >
            Clear Cache & Refresh
          </button>
          <button
            onClick={checkOllamaConnection}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium"
          >
            Check Ollama
          </button>
          <button
            onClick={() => { setLogs([]); setTestResults([]); }}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-medium"
          >
            Clear Logs
          </button>
        </div>

        {/* Timing Summary */}
        {(totalTestTime !== null || testProgress) && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold mb-2">Test Timing</h2>
            {testProgress && (
              <div className="mb-3">
                <div className="flex justify-between text-sm text-gray-400 mb-1">
                  <span>Progress: {testProgress.current} / {testProgress.total}</span>
                  <span>{Math.round((testProgress.current / testProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(testProgress.current / testProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {totalTestTime !== null && (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-indigo-400">{(totalTestTime / 1000).toFixed(2)}s</p>
                  <p className="text-sm text-gray-400">Total Time</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">{testResults.length}</p>
                  <p className="text-sm text-gray-400">Assignments Tested</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-400">
                    {testResults.length > 0 ? (totalTestTime / testResults.length / 1000).toFixed(2) : 0}s
                  </p>
                  <p className="text-sm text-gray-400">Avg per Assignment</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold mb-3">Test Results</h2>
            <div className="space-y-4">
              {testResults.map((result, idx) => (
                <div key={idx} className="bg-gray-900 rounded p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{result.assignment.title}</h3>
                      <p className="text-sm text-gray-400">
                        {result.assignment.type} | {result.assignment.courseName} | {result.assignment.pointsPossible} pts
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-400">{result.estimatedMinutes} min</p>
                      <p className="text-xs text-gray-500">{result.method} | {result.duration}ms</p>
                    </div>
                  </div>
                  <details className="mt-2">
                    <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">Show prompt & response</summary>
                    <div className="mt-2 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Prompt:</p>
                        <pre className="text-xs bg-gray-800 p-2 rounded overflow-auto max-h-32">{result.prompt}</pre>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">LLM Response:</p>
                        <pre className="text-xs bg-gray-800 p-2 rounded overflow-auto max-h-32">{String(result.response)}</pre>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Parsed JSON Output:</p>
                        <pre className="text-xs bg-green-900 p-2 rounded overflow-auto">
{JSON.stringify({ minutes: result.estimatedMinutes, reasoning: typeof result.response === 'string' ? result.response.substring(0, 100) : '' }, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Curl Command:</p>
                        <div className="relative">
                          <pre className="text-xs bg-gray-800 p-2 rounded overflow-auto max-h-24">
{`curl http://localhost:11434/api/generate -d '${JSON.stringify({
  model: (settings.localLlmModel as string) || 'qwen2.5-coder:1.5b',
  prompt: result.prompt,
  stream: false
})}'`}
                          </pre>
                          <button
                            onClick={() => {
                              const curl = `curl http://localhost:11434/api/generate -d '${JSON.stringify({
                                model: (settings.localLlmModel as string) || 'qwen2.5-coder:1.5b',
                                prompt: result.prompt,
                                stream: false
                              })}'`;
                              navigator.clipboard.writeText(curl);
                              addLog('info', 'Curl command copied to clipboard');
                            }}
                            className="absolute top-1 right-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Logs</h2>
          <div className="bg-gray-900 rounded p-3 max-h-96 overflow-auto font-mono text-xs">
            {logs.map((log, idx) => (
              <div key={idx} className={`py-1 ${
                log.type === 'error' ? 'text-red-400' :
                log.type === 'success' ? 'text-green-400' :
                log.type === 'request' ? 'text-yellow-400' :
                log.type === 'response' ? 'text-blue-400' :
                'text-gray-300'
              }`}>
                <span className="text-gray-500">[{log.timestamp}]</span>{' '}
                <span className="uppercase text-xs">[{log.type}]</span>{' '}
                {log.message}
                {log.data && (
                  <pre className="ml-4 text-gray-500 overflow-hidden text-ellipsis">
                    {typeof log.data === 'string' ? log.data.substring(0, 200) : JSON.stringify(log.data, null, 2).substring(0, 200)}
                  </pre>
                )}
              </div>
            ))}
            {logs.length === 0 && <p className="text-gray-500">No logs yet...</p>}
          </div>
        </div>

        {/* Cached Assignments Preview */}
        {cachedAssignments.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4 mt-6">
            <h2 className="text-lg font-semibold mb-3">Cached Assignments</h2>
            <div className="space-y-2">
              {cachedAssignments.map((asn, idx) => {
                const a = asn as Record<string, unknown>;
                return (
                  <div key={idx} className="bg-gray-900 rounded p-3 flex justify-between">
                    <div>
                      <p className="font-medium">{String(a.title)}</p>
                      <p className="text-sm text-gray-400">{String(a.courseName)} | {String(a.type)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{String(a.estimatedMinutes || '?')} min</p>
                      <p className="text-xs text-gray-500">{String(a.estimationMethod || 'unknown')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
