/**
 * Token-bucket rate limiter with exponential backoff retry.
 * Used to respect Canvas API rate limits and retry transient AI API failures.
 */

interface RateLimiterConfig {
  maxTokens: number;       // max burst size
  refillRate: number;      // tokens per second
}

export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;

  constructor(config: RateLimiterConfig) {
    this.maxTokens = config.maxTokens;
    this.refillRate = config.refillRate;
    this.tokens = config.maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait until a token is available
    const waitMs = ((1 - this.tokens) / this.refillRate) * 1000;
    await new Promise(resolve => setTimeout(resolve, waitMs));
    this.tokens = 0;
    this.lastRefill = Date.now();
  }
}

/**
 * Retry a function with exponential backoff.
 * Only retries on transient errors (429, 500, 502, 503, 504).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on transient errors
      const isTransient = /\b(429|500|502|503|504)\b/.test(lastError.message);
      if (!isTransient || attempt === maxRetries) {
        throw lastError;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Pre-configured rate limiter for Canvas API (10 requests per 10 seconds)
export const canvasRateLimiter = new RateLimiter({ maxTokens: 10, refillRate: 1 });
