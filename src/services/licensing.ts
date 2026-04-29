/**
 * Licensing Service
 * Handles Stripe subscription validation, tier management, and usage tracking.
 *
 * Architecture: The extension talks to a lightweight backend (Cloudflare Worker /
 * serverless function) that holds the Stripe secret key and proxies validation calls.
 * The extension never touches the Stripe secret key directly.
 */

import {
  type UserTier,
  type UsageCounters,
  type FeatureFlags,
  type UserTierLevel,
  FREE_TIER_LIMITS,
  STRIPE_CONFIG,
} from '../types';

const TIER_CACHE_KEY = 'tierCache';
const USAGE_KEY = 'usageCounters';
const TRIAL_START_KEY = 'trialStartedAt';
const SUBSCRIPTION_ID_KEY = 'stripeSubscriptionId';

// How long a cached validation remains trusted without re-checking
const VALIDATION_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class LicensingService {
  /**
   * Get the current user tier (from cache, with staleness check)
   */
  async getCachedTier(): Promise<UserTier> {
    const { [TIER_CACHE_KEY]: cached } = await chrome.storage.local.get(TIER_CACHE_KEY);

    if (cached && this.isCacheValid(cached)) {
      return cached as UserTier;
    }

    // Check if trial is active
    if (await this.isTrialActive()) {
      return this.buildTier('trial');
    }

    return this.buildTier('free');
  }

  /**
   * Validate a Stripe subscription via the backend API
   */
  async validateSubscription(subscriptionId: string): Promise<UserTier> {
    try {
      const response = await fetch(`${STRIPE_CONFIG.backendUrl}/validate-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId }),
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.status}`);
      }

      const data = await response.json();

      const tier: UserTier = {
        tier: data.active ? 'premium' : 'free',
        stripeCustomerId: data.customerId || null,
        stripeSubscriptionId: subscriptionId,
        validatedAt: Date.now(),
        expiresAt: data.currentPeriodEnd ? data.currentPeriodEnd * 1000 : null,
        trialEndsAt: null,
        status: data.status || 'active',
      };

      // Cache the result
      await chrome.storage.local.set({ [TIER_CACHE_KEY]: tier });
      await chrome.storage.sync.set({ [SUBSCRIPTION_ID_KEY]: subscriptionId });

      return tier;
    } catch (error) {
      console.error('[Licensing] Validation failed:', error);

      // If we have a cached tier, keep using it during network failures
      const { [TIER_CACHE_KEY]: cached } = await chrome.storage.local.get(TIER_CACHE_KEY);
      if (cached && this.isCacheValid(cached)) {
        return cached as UserTier;
      }

      return this.buildTier('free');
    }
  }

  /**
   * Re-validate the stored subscription (called by service worker alarm)
   */
  async refreshValidation(): Promise<UserTier> {
    const { [SUBSCRIPTION_ID_KEY]: subId } = await chrome.storage.sync.get(SUBSCRIPTION_ID_KEY);

    if (!subId) {
      if (await this.isTrialActive()) {
        return this.buildTier('trial');
      }
      return this.buildTier('free');
    }

    return this.validateSubscription(subId);
  }

  /**
   * Check if the 7-day trial is still active
   */
  async isTrialActive(): Promise<boolean> {
    const { [TRIAL_START_KEY]: startedAt } = await chrome.storage.local.get(TRIAL_START_KEY);

    if (!startedAt) return false;

    return Date.now() - startedAt < TRIAL_DURATION_MS;
  }

  /**
   * Initialize the trial (called on first install)
   */
  async startTrial(): Promise<void> {
    const { [TRIAL_START_KEY]: existing } = await chrome.storage.local.get(TRIAL_START_KEY);
    if (existing) return; // Don't restart trial

    await chrome.storage.local.set({ [TRIAL_START_KEY]: Date.now() });
    const tier = this.buildTier('trial');
    await chrome.storage.local.set({ [TIER_CACHE_KEY]: tier });
  }

  /**
   * Get feature flags based on current tier
   */
  getFeatureFlags(tierLevel: UserTierLevel): FeatureFlags {
    const isPremiumOrTrial = tierLevel === 'premium' || tierLevel === 'trial';
    return {
      unlimitedRefreshes: isPremiumOrTrial,
      calendarIntegration: isPremiumOrTrial,
      advancedAnalytics: isPremiumOrTrial,
      priorityModels: isPremiumOrTrial,
      extendedLookahead: isPremiumOrTrial,
    };
  }

  /**
   * Get current usage counters, resetting if the day has changed
   */
  async getUsageCounters(): Promise<UsageCounters> {
    const { [USAGE_KEY]: stored } = await chrome.storage.local.get(USAGE_KEY);
    const today = new Date().toISOString().split('T')[0];

    if (!stored || stored.lastResetDate !== today) {
      const fresh: UsageCounters = { aiRefreshCount: 0, lastResetDate: today };
      await chrome.storage.local.set({ [USAGE_KEY]: fresh });
      return fresh;
    }

    return stored as UsageCounters;
  }

  /**
   * Increment the daily AI refresh counter
   */
  async incrementAIRefreshCount(): Promise<UsageCounters> {
    const counters = await this.getUsageCounters();
    counters.aiRefreshCount += 1;
    await chrome.storage.local.set({ [USAGE_KEY]: counters });
    return counters;
  }

  /**
   * Check whether the user can perform an AI-powered refresh
   */
  async canUseAIRefresh(): Promise<boolean> {
    const tier = await this.getCachedTier();
    const flags = this.getFeatureFlags(tier.tier);

    if (flags.unlimitedRefreshes) return true;

    const counters = await this.getUsageCounters();
    return counters.aiRefreshCount < FREE_TIER_LIMITS.maxAIRefreshesPerDay;
  }

  /**
   * Get the maximum lookahead days allowed for the current tier
   */
  async getMaxLookaheadDays(): Promise<number> {
    const tier = await this.getCachedTier();
    const flags = this.getFeatureFlags(tier.tier);
    return flags.extendedLookahead ? 90 : FREE_TIER_LIMITS.maxLookaheadDays;
  }

  /**
   * Check if a model is allowed for the current tier
   */
  isModelAllowed(model: string, tierLevel: UserTierLevel): boolean {
    const flags = this.getFeatureFlags(tierLevel);
    if (flags.priorityModels) return true;
    return FREE_TIER_LIMITS.allowedModels.includes(model as any);
  }

  /**
   * Remove subscription and revert to free tier
   */
  async clearSubscription(): Promise<void> {
    await chrome.storage.sync.remove(SUBSCRIPTION_ID_KEY);
    await chrome.storage.local.set({ [TIER_CACHE_KEY]: this.buildTier('free') });
  }

  // --- Private helpers ---

  private isCacheValid(cached: UserTier): boolean {
    if (!cached.validatedAt) return false;
    return Date.now() - cached.validatedAt < VALIDATION_GRACE_PERIOD_MS;
  }

  private buildTier(level: UserTierLevel): UserTier {
    return {
      tier: level,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      validatedAt: Date.now(),
      expiresAt: null,
      trialEndsAt: level === 'trial' ? Date.now() + TRIAL_DURATION_MS : null,
      status: level === 'trial' ? 'trialing' : level === 'premium' ? 'active' : 'unchecked',
    };
  }
}

export const licensingService = new LicensingService();
