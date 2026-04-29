import React from 'react';
import { STRIPE_CONFIG } from '../../types';

interface UpgradePromptProps {
  feature: string;
  compact?: boolean;
}

export function UpgradePrompt({ feature, compact = false }: UpgradePromptProps) {
  if (compact) {
    return (
      <div className="text-center py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">{feature}</span> is a Premium feature.{' '}
          <a
            href={STRIPE_CONFIG.pricingPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-canvas-red font-medium hover:underline"
          >
            Upgrade
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-8 px-4">
      <div className="text-3xl mb-2">&#x1F512;</div>
      <h3 className="text-sm font-semibold text-gray-800 mb-1">{feature}</h3>
      <p className="text-xs text-gray-500 mb-3">
        Upgrade to Premium to unlock this feature.
      </p>
      <a
        href={STRIPE_CONFIG.pricingPageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-4 py-2 bg-canvas-red text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
      >
        Upgrade - $3.99/mo
      </a>
    </div>
  );
}
