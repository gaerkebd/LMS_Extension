import React, { useState, useEffect } from 'react';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { STRIPE_CONFIG } from '../../types';

export function AccountSection() {
  const { tier, isPremium, isTrial, isFree, remainingRefreshes, trialDaysLeft, refresh } = useFeatureGate();
  const [subscriptionId, setSubscriptionId] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    chrome.storage.sync.get('stripeSubscriptionId', (data) => {
      if (data.stripeSubscriptionId) setSubscriptionId(data.stripeSubscriptionId);
    });
  }, []);

  async function handleValidate() {
    if (!subscriptionId.trim()) return;

    setValidating(true);
    setValidationResult('idle');

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'VALIDATE_SUBSCRIPTION',
        subscriptionId: subscriptionId.trim(),
      });

      if (result?.tier === 'premium') {
        setValidationResult('success');
        refresh();
      } else {
        setValidationResult('error');
      }
    } catch {
      setValidationResult('error');
    }

    setValidating(false);
  }

  const tierBadge = isPremium
    ? { label: 'PRO', color: 'bg-yellow-400 text-yellow-900' }
    : isTrial
    ? { label: 'TRIAL', color: 'bg-blue-400 text-blue-900' }
    : { label: 'FREE', color: 'bg-gray-300 text-gray-700' };

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-800">Account</h2>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tierBadge.color}`}>
          {tierBadge.label}
        </span>
      </div>

      {isTrial && trialDaysLeft !== null && (
        <p className="text-sm text-blue-600 mb-4">
          Premium trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}
        </p>
      )}

      {isFree && (
        <p className="text-sm text-gray-500 mb-4">
          {remainingRefreshes} of 5 AI refreshes remaining today.{' '}
          <a
            href={STRIPE_CONFIG.pricingPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-canvas-purple font-medium hover:underline"
          >
            Upgrade to Premium
          </a>
        </p>
      )}

      {isPremium && (
        <div className="mb-4">
          <p className="text-sm text-green-600 mb-2">Premium subscription active</p>
          <a
            href={STRIPE_CONFIG.customerPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-canvas-purple hover:underline"
          >
            Manage subscription
          </a>
        </div>
      )}

      {!isPremium && (
        <div className="space-y-3">
          <div>
            <label htmlFor="subscription-id" className="block text-sm font-medium text-gray-700 mb-1">
              Subscription ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="subscription-id"
                value={subscriptionId}
                onChange={(e) => setSubscriptionId(e.target.value)}
                placeholder="sub_..."
                className="input flex-1"
              />
              <button
                onClick={handleValidate}
                disabled={validating || !subscriptionId.trim()}
                className="btn btn-primary text-sm disabled:opacity-50"
              >
                {validating ? 'Validating...' : 'Activate'}
              </button>
            </div>
            {validationResult === 'success' && (
              <p className="mt-1 text-sm text-green-600">Subscription activated!</p>
            )}
            {validationResult === 'error' && (
              <p className="mt-1 text-sm text-red-600">Invalid or expired subscription</p>
            )}
          </div>

          <div className="p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
            <p className="text-sm font-medium text-gray-800 mb-1">Upgrade to Premium</p>
            <ul className="text-xs text-gray-600 space-y-1 mb-2">
              <li>Unlimited AI-powered refreshes</li>
              <li>Google Calendar study block scheduling</li>
              <li>Advanced workload analytics</li>
              <li>Priority AI models (GPT-4o, Claude 3.5 Sonnet)</li>
              <li>Extended 90-day lookahead</li>
            </ul>
            <p className="text-xs text-gray-500">
              $3.99/month or $29.99/year
            </p>
            <a
              href={STRIPE_CONFIG.pricingPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 btn btn-primary text-sm"
            >
              Get Premium
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
