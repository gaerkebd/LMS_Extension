import React from 'react';

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
      <div className="relative w-12 h-12 mb-4">
        <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-canvas-red rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p className="text-sm text-gray-500">Loading assignments...</p>
    </div>
  );
}
