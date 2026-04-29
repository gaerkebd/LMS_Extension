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
  aiProvider: 'none' | 'openai' | 'anthropic' | 'local';
  openaiApiKey?: string;
  anthropicApiKey?: string;
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
  maxAIRefreshesPerDay: 5,
  maxLookaheadDays: 7,
  allowedModels: ['gpt-4o-mini', 'gpt-3.5-turbo', 'claude-3-haiku-20240307', 'qwen2.5-coder:1.5b', 'llama3:8b'],
} as const;

export const PREMIUM_MODELS = ['gpt-4o', 'claude-3-5-sonnet-20241022'] as const;

export interface AnalyticsEntry {
  date: string; // YYYY-MM-DD
  totalMinutes: number;
  assignmentCount: number;
  byCourse: { courseName: string; minutes: number; count: number }[];
}

export interface CalendarStudyBlock {
  assignmentId: string | number;
  assignmentTitle: string;
  startTime: string; // ISO
  endTime: string; // ISO
  durationMinutes: number;
}

// === Stripe Config ===

export const STRIPE_CONFIG = {
  // Replace with your actual backend URL when deployed
  backendUrl: 'https://your-backend.workers.dev',
  pricingPageUrl: 'https://your-stripe-checkout-url.com',
  customerPortalUrl: 'https://billing.stripe.com/p/login/your-portal-id',
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
