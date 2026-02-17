import React from 'react';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in">
      <span className="text-5xl mb-4">😕</span>
      <h2 className="text-lg font-semibold text-gray-800 mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">{message}</p>

      <button onClick={onRetry} className="btn btn-secondary">
        Try Again
      </button>
    </div>
  );
}
