import React from 'react';
import { FREE_TIER_LIMITS, STRIPE_CONFIG } from '../../types';

interface UsageMeterProps {
  remaining: number;
  isFree: boolean;
}

export function UsageMeter({ remaining, isFree }: UsageMeterProps) {
  if (!isFree) return null;

  const max = FREE_TIER_LIMITS.maxAIRefreshesPerDay;
  const used = max - remaining;
  const pct = Math.min(100, (used / max) * 100);
  const isExhausted = remaining <= 0;

  return (
    <div className="mx-4 mb-3 p-2 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">
          AI Refreshes: {remaining}/{max} remaining
        </span>
        {isExhausted && (
          <a
            href={STRIPE_CONFIG.pricingPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-canvas-red font-medium hover:underline"
          >
            Upgrade
          </a>
        )}
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isExhausted ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isExhausted && (
        <p className="text-xs text-gray-500 mt-1">
          Using heuristic estimates. Resets at midnight.
        </p>
      )}
    </div>
  );
}
