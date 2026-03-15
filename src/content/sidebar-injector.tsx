/**
 * Content Script - Sidebar Injection
 * Injects the time estimator sidebar into Canvas LMS pages
 * This runs in addition to the existing popup functionality
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasSidebar } from './CanvasSidebar';

(function() {
  'use strict';

  console.log('Canvas Time Estimator: Sidebar injection initialized');

  // Wait for the right sidebar to be available
  function waitForRightSidebar(): Promise<Element> {
    return new Promise((resolve) => {
      const checkForSidebar = () => {
        const rightSide = document.querySelector('#right-side');
        if (rightSide) {
          resolve(rightSide);
        } else {
          setTimeout(checkForSidebar, 100);
        }
      };
      checkForSidebar();
    });
  }

  async function injectSidebar() {
    try {
      // Check if sidebar injection is enabled
      const settings = await chrome.storage.sync.get(['showSidebar']);

      // Default to true if not set
      if (settings.showSidebar === false) {
        console.log('Canvas Time Estimator: Sidebar injection disabled in settings');
        return;
      }

      // Wait for the Canvas right sidebar
      const rightSide = await waitForRightSidebar();

      // Check if we've already injected
      if (document.querySelector('#canvas-time-estimator-container')) {
        console.log('Canvas Time Estimator: Already injected');
        return;
      }

      // Find and hide the Canvas To Do list container
      const todoContainer = rightSide.querySelector('.Sidebar__TodoListContainer');
      if (todoContainer) {
        (todoContainer as HTMLElement).style.display = 'none';
        console.log('Canvas Time Estimator: Hidden Canvas To Do list');
      }

      // Create container for our React app
      const container = document.createElement('div');
      container.id = 'canvas-time-estimator-container';

      // Prepend to right sidebar (replaces the To Do list position)
      rightSide.prepend(container);

      // Render the React component
      const root = createRoot(container);
      root.render(
        <React.StrictMode>
          <CanvasSidebar />
        </React.StrictMode>
      );

      console.log('Canvas Time Estimator: Sidebar injected successfully');
    } catch (error) {
      console.error('Canvas Time Estimator: Failed to inject sidebar', error);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSidebar);
  } else {
    injectSidebar();
  }
})();
