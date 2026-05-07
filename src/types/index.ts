/**
 * Core type definitions for Canvas Time Estimator
 */

export interface Assignment {
  id: string | number;
  title: string;
  courseName: string;
  courseId: number;
  dueDate: string;
  type: AssignmentType;
  description: string;
  pointsPossible: number;
  htmlUrl: string;
  submissionTypes: string[];
  estimatedMinutes: number | null;
  estimationConfidence: 'low' | 'medium' | 'high' | null;
}

export type AssignmentType =
  | 'assignment'
  | 'quiz'
  | 'discussion'
  | 'essay'
  | 'project'
  | 'exam'
  | 'page'
  | 'announcement'
  | 'event'
  | 'note';

export interface AssignmentResponse {
  assignments: Assignment[];
  fromCache: boolean;
  lastUpdated: number;
  error?: string;
}

export interface Settings {
  canvasUrl: string;
  apiToken: string;
  aiProvider: 'none' | 'openai' | 'local';
  openaiApiKey?: string;
  localLlmUrl?: string;
  localLlmModel?: string;
  estimationModel: string;
  showNotifications: boolean;
  refreshInterval: number;
  lookaheadDays: number;
  injectBadges: boolean;
  showSidebar: boolean;
}

export interface TimeEstimate {
  estimatedMinutes: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning?: string;
}

// === Licensing & Monetization ===

export type UserTierLevel = 'free' | 'premium' | 'trial';

export interface UserTier {
  tier: UserTierLevel;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  validatedAt: number | null;
  expiresAt: number | null;
  trialEndsAt: number | null;
  status: 'active' | 'past_due' | 'canceled' | 'expired' | 'trialing' | 'unchecked';
}

export interface UsageCounters {
  aiRefreshCount: number;
  lastResetDate: string; // YYYY-MM-DD
}

export interface FeatureFlags {
  unlimitedRefreshes: boolean;
  calendarIntegration: boolean;
  advancedAnalytics: boolean;
  priorityModels: boolean;
  extendedLookahead: boolean;
}

export const FREE_TIER_LIMITS = {
  maxAIRefreshesPerDay: 1,
  maxLookaheadDays: 2,
  allowedModels: ['gpt-4o-mini', 'gpt-3.5-turbo', 'qwen2.5-coder:1.5b', 'llama3:8b'],
} as const;

export const PREMIUM_MODELS = ['gpt-4o'] as const;

export interface AnalyticsEntry {
  date: string; // YYYY-MM-DD
  totalMinutes: number;
  assignmentCount: number;
  byCourse: { courseName: string; minutes: number; count: number }[];
}

export interface CalendarStudyBlock {
  assignmentId: string | number;
  assignmentTitle: string;
  date: string;
  startTime: string; // ISO
  endTime: string; // ISO
  durationMinutes: number;
}

// === Assignment Input & AI Estimate (shared between estimator, service worker, and sidebar) ===

/**
 * Lightweight assignment descriptor used as input to the time estimator and
 * stored in chrome.storage.local as `cachedAssignments`.
 * Every entry MUST have a unique assignmentID so it can be joined with
 * its corresponding AIEstimateResult.
 */
export interface AssignmentInput {
  assignmentID: number;
  title: string;
  type: string;
  courseName: string;
  courseId: number;
  dueDate: string;
  htmlUrl: string;
  pointsPossible?: number;
  submissionTypes?: string[];
  description?: string;
  [key: string]: unknown;
}

/**
 * The AI (or heuristic) estimate result for one assignment.
 * Stored in chrome.storage.local as `aiEstimateResults`.
 * Linked to an AssignmentInput via `assignmentID`.
 */
export interface AIEstimateResult {
  assignmentID: number;
  minutes: number;
  reasoning?: string;
}

// === Stripe Config ===

/**
 * REQUIRED BEFORE LAUNCH — all three values below are placeholders.
 * The extension will NOT validate premium subscriptions until these are replaced.
 * When the backend URL is a placeholder, validateSubscription() will always fail
 * and fall back to the cached tier (graceful degradation, but premium never activates).
 *
 * TODO (pre-CWS launch):
 *  1. backendUrl       — deploy the Cloudflare Worker (or equivalent serverless function)
 *                        that proxies Stripe subscription validation using your Stripe secret key,
 *                        then replace this with its real *.workers.dev (or custom) URL.
 *  2. pricingPageUrl   — replace with the real Stripe Checkout / pricing page URL
 *                        (e.g. https://buy.stripe.com/<price_id> or your hosted checkout link).
 *  3. customerPortalUrl — replace the placeholder portal ID segment with your real
 *                        Stripe Customer Portal configuration ID
 *                        (found in Stripe Dashboard → Billing → Customer portal → Configuration ID).
 */
export const STRIPE_CONFIG = {
  backendUrl: 'https://your-backend.workers.dev',        // TODO: replace with real Cloudflare Worker URL
  pricingPageUrl: 'https://your-stripe-checkout-url.com', // TODO: replace with real Stripe Checkout URL
  customerPortalUrl: 'https://billing.stripe.com/p/login/your-portal-id', // TODO: replace portal ID segment
} as const;

// Message types for chrome.runtime.sendMessage
export type MessageType =
  | { type: 'GET_ASSIGNMENTS' }
  | { type: 'REFRESH_ASSIGNMENTS' }
  | { type: 'GET_CACHED_ASSIGNMENTS' }
  | { type: 'ESTIMATE_SINGLE'; assignment: Partial<Assignment> }
  | { type: 'TEST_CONNECTION'; url: string; token: string }
  | { type: 'GET_USER_TIER' }
  | { type: 'VALIDATE_SUBSCRIPTION'; subscriptionId: string }
  | { type: 'GET_USAGE' }
  | { type: 'CHECK_CAN_REFRESH' }
  | { type: 'GET_FEATURE_FLAGS' }
  | { type: 'SYNC_CALENDAR' }
  | { type: 'GET_ANALYTICS' };
