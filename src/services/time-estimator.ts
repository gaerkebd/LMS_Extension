/**
 * Time Estimation Service
 * Uses AI to estimate how long assignments will take to complete
 */

import { withRetry } from '../utils/rate-limiter';
import type { AssignmentInput, AIEstimateResult } from '../types';

/** Raw response from an AI endpoint before we attach the assignmentID. */
interface RawAIResponse {
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
      'localLlmUrl',
      'localLlmModel',
      'estimationModel'
    ]);

    this.aiProvider = settings.aiProvider || 'none';
    this.model = settings.estimationModel || 'gpt-3.5-turbo';

    if (this.aiProvider === 'openai') {
      this.apiKey = settings.openaiApiKey;
    } else if (this.aiProvider === 'local') {
      this.localLlmUrl = settings.localLlmUrl || 'http://localhost:11434';
      this.localLlmModel = settings.localLlmModel || 'qwen2.5-coder:1.5b';
    }
  }

  /**
   * Estimate time for all assignments.
   * Returns one AIEstimateResult per input, keyed by assignmentID.
   */
  async estimateAll(assignments: AssignmentInput[]): Promise<AIEstimateResult[]> {
    await this.configure();

    const results: AIEstimateResult[] = [];

    for (const assignment of assignments) {
      const result = await this.estimateSingle(assignment);
      results.push(result);
    }

    return results;
  }

  /**
   * Estimate time for a single assignment.
   * Returns an AIEstimateResult with the assignmentID linked.
   */
  async estimateSingle(assignment: AssignmentInput): Promise<AIEstimateResult> {
    await this.configure();

    const useAI =
      this.aiProvider === 'local' ||
      (this.apiKey && this.aiProvider === 'openai');

    if (useAI) {
      try {
        return await this.getAIEstimate(assignment);
      } catch (error) {
        console.warn('[TimeEstimator] AI estimation failed, using heuristics:', error);
      }
    }

    return {
      assignmentID: assignment.assignmentID,
      minutes: this.getHeuristicEstimate(assignment),
    };
  }

  /**
   * Get AI-powered time estimate and attach the assignmentID.
   */
  async getAIEstimate(assignment: AssignmentInput): Promise<AIEstimateResult> {
    const prompt = this.buildPrompt(assignment);

    return withRetry(async () => {
      let raw: RawAIResponse;

      if (this.aiProvider === 'openai') {
        raw = await this.callOpenAI(prompt);
      } else if (this.aiProvider === 'local') {
        raw = await this.callOllama(prompt);
      } else {
        throw new Error(`Unknown AI provider: ${this.aiProvider}`);
      }

      return { assignmentID: assignment.assignmentID, ...raw };
    }, 2, 1000);
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
   * OpenAI API — not yet implemented.
   * Falls back to heuristics automatically via estimateSingle().
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async callOpenAI(_prompt: string): Promise<RawAIResponse> {
    throw new Error('OpenAI integration coming soon. Falling back to heuristics.');
  }

  /**
   * Call Ollama API (local LLM)
   */
  async callOllama(prompt: string): Promise<RawAIResponse> {
    const url = `${this.localLlmUrl}/api/generate`;

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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.response;

    try {
      const jsonMatch = content.match(/\{[\s\S]*"minutes"[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No JSON found');
    } catch {
      const match = content.match(/(\d+)\s*minutes?/i);
      if (match) {
        return { minutes: parseInt(match[1]), reasoning: content };
      }
      console.warn('Could not parse Ollama response, using default estimate');
      return { minutes: 60, reasoning: 'Could not parse LLM response' };
    }
  }

  /**
   * Get heuristic-based time estimate (fallback). Returns minutes only.
   */
  getHeuristicEstimate(assignment: AssignmentInput): number {
    const type = this.categorizeAssignment(assignment);
    const rules = this.defaultEstimates[type] || this.defaultEstimates.default;

    let minutes = rules.base;

    if (typeof assignment.pointsPossible === 'number') {
      minutes += assignment.pointsPossible * rules.perPoint;
    }

    if (Array.isArray(assignment.submissionTypes)) {
      if (assignment.submissionTypes.includes('online_upload')) {
        minutes += 15;
      }
      if (assignment.submissionTypes.includes('media_recording')) {
        minutes += 30;
      }
    }

    return Math.min(Math.max(minutes, 15), 480);
  }

  /**
   * Categorize assignment type
   */
  categorizeAssignment(assignment: AssignmentInput): string {
    const title = (assignment.title || '').toLowerCase();
    const type = (assignment.type || '').toLowerCase();

    if (type === 'quiz' || /[Qq]uiz/.test(title)) return 'quiz';
    if (type === 'discussion' || /[Dd]iscussion/.test(title)) return 'discussion';
    if (/[Ee]ssay/.test(title) || /[Pp]aper/.test(title)) return 'essay';
    if (/[Pp]roject/.test(title) || /[Pp]resentation/.test(title)) return 'project';
    if (/[Ee]xam/.test(title) || /[Tt]est/.test(title) || /[Mm]idterm/.test(title) || /[Ff]inal/.test(title)) return 'exam';
    if (/[Rr]eading/.test(title) || /[Rr]ead/.test(title)) return 'reading';

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
