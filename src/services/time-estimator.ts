/**
 * Time Estimation Service
 * Uses AI to estimate how long assignments will take to complete
 */

interface AssignmentInput {
  title?: string;
  type?: string;
  courseName?: string;
  pointsPossible?: number;
  submissionTypes?: string[];
  description?: string;
  [key: string]: unknown;
}

interface AIEstimateResult {
  minutes: number;
  reasoning?: string;
}

export class TimeEstimator {
  private aiProvider: string | null;
  private apiKey: string | null;
  private model: string;
  private localLlmUrl: string;
  private localLlmModel: string;
  private defaultEstimates: Record<string, { base: number; perPoint: number }>;

  constructor() {
    this.aiProvider = null;
    this.apiKey = null;
    this.model = 'gpt-3.5-turbo';
    this.localLlmUrl = 'http://localhost:11434';
    this.localLlmModel = 'qwen2.5-coder:1.5b';

    // Default estimation rules (fallback when AI is unavailable)
    this.defaultEstimates = {
      quiz: { base: 30, perPoint: 1 },
      discussion: { base: 45, perPoint: 2 },
      assignment: { base: 60, perPoint: 3 },
      essay: { base: 120, perPoint: 5 },
      project: { base: 180, perPoint: 8 },
      exam: { base: 90, perPoint: 2 },
      reading: { base: 30, perPoint: 1 },
      default: { base: 60, perPoint: 2 }
    };
  }

  /**
   * Configure the AI provider
   */
  async configure(): Promise<void> {
    const settings = await chrome.storage.sync.get([
      'aiProvider',
      'openaiApiKey',
      'anthropicApiKey',
      'localLlmUrl',
      'localLlmModel',
      'estimationModel'
    ]);

    this.aiProvider = settings.aiProvider || 'none';
    this.model = settings.estimationModel || 'gpt-3.5-turbo';

    console.log('[TimeEstimator] Configure called with settings:', {
      aiProvider: this.aiProvider,
      model: this.model,
      hasOpenAIKey: !!settings.openaiApiKey,
      hasAnthropicKey: !!settings.anthropicApiKey,
      localLlmUrl: settings.localLlmUrl,
      localLlmModel: settings.localLlmModel
    });

    if (this.aiProvider === 'openai') {
      this.apiKey = settings.openaiApiKey;
    } else if (this.aiProvider === 'anthropic') {
      this.apiKey = settings.anthropicApiKey;
    } else if (this.aiProvider === 'local') {
      this.localLlmUrl = settings.localLlmUrl || 'http://localhost:11434';
      this.localLlmModel = settings.localLlmModel || 'qwen2.5-coder:1.5b';
      console.log('[TimeEstimator] Local LLM configured:', this.localLlmUrl, this.localLlmModel);
    }
  }

  /**
   * Estimate time for all assignments
   */
  async estimateAll(assignments: AssignmentInput[]): Promise<AssignmentInput[]> {
    await this.configure();

    const estimatedAssignments: AssignmentInput[] = [];

    for (const assignment of assignments) {
      const estimated = await this.estimateSingle(assignment);
      estimatedAssignments.push(estimated);
    }

    return estimatedAssignments;
  }

  /**
   * Estimate time for a single assignment
   */
  async estimateSingle(assignment: AssignmentInput): Promise<AssignmentInput> {
    await this.configure();

    let estimatedMinutes: number;
    let estimationMethod: string;

    // Try AI estimation if configured
    const useAI = this.aiProvider === 'local' || (this.apiKey && (this.aiProvider === 'openai' || this.aiProvider === 'anthropic'));

    console.log('[TimeEstimator] estimateSingle:', {
      assignmentTitle: assignment.title,
      aiProvider: this.aiProvider,
      useAI,
      hasApiKey: !!this.apiKey,
      localLlmUrl: this.localLlmUrl
    });

    if (useAI) {
      try {
        console.log('[TimeEstimator] Calling AI estimation for:', assignment.title);
        const aiEstimate = await this.getAIEstimate(assignment);
        estimatedMinutes = aiEstimate.minutes;
        estimationMethod = 'ai';
        console.log('[TimeEstimator] AI estimate result:', aiEstimate);
      } catch (error) {
        console.warn('[TimeEstimator] AI estimation failed, using heuristics:', error);
        estimatedMinutes = this.getHeuristicEstimate(assignment);
        estimationMethod = 'heuristic';
      }
    } else {
      console.log('[TimeEstimator] Using heuristics (AI not configured)');
      estimatedMinutes = this.getHeuristicEstimate(assignment);
      estimationMethod = 'heuristic';
    }

    return {
      ...assignment,
      estimatedMinutes,
      estimationMethod,
      estimatedAt: Date.now()
    };
  }

  /**
   * Get AI-powered time estimate
   */
  async getAIEstimate(assignment: AssignmentInput): Promise<AIEstimateResult> {
    const prompt = this.buildPrompt(assignment);

    if (this.aiProvider === 'openai') {
      return await this.callOpenAI(prompt);
    } else if (this.aiProvider === 'anthropic') {
      return await this.callAnthropic(prompt);
    } else if (this.aiProvider === 'local') {
      return await this.callOllama(prompt);
    }

    throw new Error(`Unknown AI provider: ${this.aiProvider}`);
  }

  /**
   * Build prompt for AI estimation
   */
  buildPrompt(assignment: AssignmentInput): string {
    const details = [
      `Title: ${assignment.title}`,
      `Type: ${assignment.type}`,
      `Course: ${assignment.courseName}`,
      typeof assignment.pointsPossible === 'number' ? `Points: ${assignment.pointsPossible}` : null,
      assignment.submissionTypes?.length ? `Submission types: ${assignment.submissionTypes.join(', ')}` : null,
      assignment.description ? `Description snippet: ${this.truncate(this.stripHtml(assignment.description), 500)}` : null
    ].filter(Boolean).join('\n');

    return `You are an academic workload estimator. Based on the following assignment details, estimate how many minutes it would take an average student to complete this assignment.

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
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(prompt: string): Promise<AIEstimateResult> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an academic workload estimation assistant. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    try {
      return JSON.parse(content);
    } catch {
      // Try to extract minutes from the response
      const match = content.match(/(\d+)\s*minutes?/i);
      if (match) {
        return { minutes: parseInt(match[1]), reasoning: content };
      }
      throw new Error('Could not parse AI response');
    }
  }

  /**
   * Call Anthropic API
   */
  async callAnthropic(prompt: string): Promise<AIEstimateResult> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text;

    try {
      return JSON.parse(content);
    } catch {
      const match = content.match(/(\d+)\s*minutes?/i);
      if (match) {
        return { minutes: parseInt(match[1]), reasoning: content };
      }
      throw new Error('Could not parse AI response');
    }
  }

  /**
   * Call Ollama API (local LLM)
   */
  async callOllama(prompt: string): Promise<AIEstimateResult> {
    const url = `${this.localLlmUrl}/api/generate`;
    console.log('[TimeEstimator] Calling Ollama:', {
      url,
      model: this.localLlmModel,
      promptLength: prompt.length
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.localLlmModel,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
        }
      })
    });

    console.log('[TimeEstimator] Ollama response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TimeEstimator] Ollama error:', errorText);
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.response;
    console.log('[TimeEstimator] Ollama raw response:', content);

    try {
      // Try to parse JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*"minutes"[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No JSON found');
    } catch {
      // Try to extract minutes from the response
      const match = content.match(/(\d+)\s*minutes?/i);
      if (match) {
        return { minutes: parseInt(match[1]), reasoning: content };
      }
      // Default fallback
      console.warn('Could not parse Ollama response, using default estimate');
      return { minutes: 60, reasoning: 'Could not parse LLM response' };
    }
  }

  /**
   * Get heuristic-based time estimate (fallback)
   */
  getHeuristicEstimate(assignment: AssignmentInput): number {
    const type = this.categorizeAssignment(assignment);
    const rules = this.defaultEstimates[type] || this.defaultEstimates.default;

    let minutes = rules.base;

    // Adjust based on points
    if (typeof assignment.pointsPossible === 'number') {
      minutes += assignment.pointsPossible * rules.perPoint;
    }

    // Adjust based on submission types
    if (Array.isArray(assignment.submissionTypes)) {
      if (assignment.submissionTypes.includes('online_upload')) {
        minutes += 15; // Time for formatting and uploading
      }
      if (assignment.submissionTypes.includes('media_recording')) {
        minutes += 30; // Recording takes extra time
      }
    }

    // Cap at reasonable limits
    return Math.min(Math.max(minutes, 15), 480); // 15 min to 8 hours
  }

  /**
   * Categorize assignment type
   */
  categorizeAssignment(assignment: AssignmentInput): string {
    const title = (assignment.title || '').toLowerCase();
    const type = (assignment.type || '').toLowerCase();

    if (type === 'quiz' || title.includes('quiz')) return 'quiz';
    if (type === 'discussion' || title.includes('discussion')) return 'discussion';
    if (title.includes('essay') || title.includes('paper')) return 'essay';
    if (title.includes('project') || title.includes('presentation')) return 'project';
    if (title.includes('exam') || title.includes('test') || title.includes('midterm') || title.includes('final')) return 'exam';
    if (title.includes('reading') || title.includes('read')) return 'reading';

    return 'assignment';
  }

  /**
   * Strip HTML tags from text
   */
  stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Truncate text to a maximum length
   */
  truncate(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}

// Export singleton instance
export const timeEstimator = new TimeEstimator();
