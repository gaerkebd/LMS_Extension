/**
 * React hook for checking user tier and feature access.
 * UI components use this to show/hide/lock premium features.
 */

import { useState, useEffect, useCallback } from 'react';
import type { UserTier, FeatureFlags, UsageCounters } from '../types';
import { FREE_TIER_LIMITS } from '../types';

interface FeatureGate {
  tier: UserTier | null;
  flags: FeatureFlags | null;
  usage: UsageCounters | null;
  loading: boolean;
  isPremium: boolean;
  isTrial: boolean;
  isFree: boolean;
  remainingRefreshes: number;
  trialDaysLeft: number | null;
  refresh: () => void;
}

export function useFeatureGate(): FeatureGate {
  const [tier, setTier] = useState<UserTier | null>(null);
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [usage, setUsage] = useState<UsageCounters | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);

    let pending = 3;
    const done = () => { if (--pending === 0) setLoading(false); };

    chrome.runtime.sendMessage({ type: 'GET_USER_TIER' }, (res) => {
      if (res && !res.error) setTier(res);
      done();
    });

    chrome.runtime.sendMessage({ type: 'GET_FEATURE_FLAGS' }, (res) => {
      if (res && !res.error) setFlags(res);
      done();
    });

    chrome.runtime.sendMessage({ type: 'GET_USAGE' }, (res) => {
      if (res && !res.error) setUsage(res);
      done();
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isPremium = tier?.tier === 'premium';
  const isTrial = tier?.tier === 'trial';
  const isFree = !isPremium && !isTrial;

  const remainingRefreshes = flags?.unlimitedRefreshes
    ? Infinity
    : Math.max(0, FREE_TIER_LIMITS.maxAIRefreshesPerDay - (usage?.aiRefreshCount || 0));

  let trialDaysLeft: number | null = null;
  if (isTrial && tier?.trialEndsAt) {
    trialDaysLeft = Math.max(0, Math.ceil((tier.trialEndsAt - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  return {
    tier,
    flags,
    usage,
    loading,
    isPremium,
    isTrial,
    isFree,
    remainingRefreshes,
    trialDaysLeft,
    refresh: loadData,
  };
}
