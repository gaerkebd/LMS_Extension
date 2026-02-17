/**
 * Content Script
 * Injects time estimates directly into the Canvas LMS interface
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    updateInterval: 5000, // Check for new elements every 5 seconds
    badgeClass: 'canvas-time-estimate-badge',
    processedAttr: 'data-time-estimated'
  };

  /**
   * Initialize the content script
   */
  function init() {
    console.log('Canvas Time Estimator: Content script initialized');

    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady);
    } else {
      onReady();
    }
  }

  /**
   * Called when DOM is ready
   */
  function onReady() {
    // Initial injection
    injectTimeEstimates();

    // Set up observer for dynamic content
    observeDOMChanges();

    // Periodic check for new content
    setInterval(injectTimeEstimates, CONFIG.updateInterval);
  }

  /**
   * Inject time estimates into assignment elements
   */
  async function injectTimeEstimates() {
    // Find assignment elements in the todo list / planner
    const assignmentElements = findAssignmentElements();

    for (const element of assignmentElements) {
      if (element.hasAttribute(CONFIG.processedAttr)) continue;

      const assignmentInfo = extractAssignmentInfo(element);
      if (!assignmentInfo) continue;

      try {
        const estimate = await getTimeEstimate(assignmentInfo);
        if (estimate) {
          injectBadge(element, estimate);
          element.setAttribute(CONFIG.processedAttr, 'true');
        }
      } catch (error) {
        console.warn('Failed to get estimate for assignment:', error);
      }
    }
  }

  /**
   * Find assignment elements on the page
   */
  function findAssignmentElements() {
    const selectors = [
      // Planner view items
      '.planner-item',
      '[data-testid="planner-item"]',
      // Dashboard cards
      '.DashboardCard .ic-DashboardCard__action-container a',
      // Todo sidebar items
      '.todo-list-item',
      '#planner-todosidebar-item',
      // Assignment list items
      '.assignment-list .assignment',
      '.ig-row',
      // Calendar events
      '.fc-event'
    ];

    return document.querySelectorAll(selectors.join(', '));
  }

  /**
   * Extract assignment information from an element
   */
  function extractAssignmentInfo(element) {
    // Try to get assignment title
    const titleElement = element.querySelector(
      '.planner-item-link, .assignment-title, .ig-title, .fc-title, a[href*="assignments"]'
    );

    if (!titleElement) return null;

    const title = titleElement.textContent?.trim();
    if (!title) return null;

    // Try to get course name
    const courseElement = element.querySelector(
      '.planner-item-title, .course-name, [class*="course"]'
    );
    const courseName = courseElement?.textContent?.trim() || 'Unknown Course';

    // Try to get due date
    const dateElement = element.querySelector(
      '.planner-item-time, .due-date, time, [class*="date"]'
    );
    const dueDate = dateElement?.getAttribute('datetime') || dateElement?.textContent;

    // Try to get assignment type
    const typeElement = element.querySelector('[class*="type"], [class*="icon"]');
    const type = detectAssignmentType(element, title);

    // Try to get assignment URL for more details
    const linkElement = element.querySelector('a[href*="assignments"], a[href*="quizzes"]');
    const url = linkElement?.href;

    // Extract assignment ID from URL
    const idMatch = url?.match(/(?:assignments|quizzes)\/(\d+)/);
    const id = idMatch ? idMatch[1] : null;

    return {
      id,
      title,
      courseName,
      dueDate,
      type,
      url
    };
  }

  /**
   * Detect assignment type from element or title
   */
  function detectAssignmentType(element, title) {
    const titleLower = title.toLowerCase();
    const html = element.innerHTML.toLowerCase();

    if (titleLower.includes('quiz') || html.includes('quiz')) return 'quiz';
    if (titleLower.includes('discussion') || html.includes('discussion')) return 'discussion';
    if (titleLower.includes('essay') || titleLower.includes('paper')) return 'essay';
    if (titleLower.includes('project') || titleLower.includes('presentation')) return 'project';
    if (titleLower.includes('exam') || titleLower.includes('test')) return 'exam';

    return 'assignment';
  }

  /**
   * Get time estimate from background script
   */
  async function getTimeEstimate(assignmentInfo) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'ESTIMATE_SINGLE', assignment: assignmentInfo },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response?.estimatedMinutes) {
            resolve(response);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * Inject time estimate badge into element
   */
  function injectBadge(element, estimate) {
    // Remove existing badge if present
    const existingBadge = element.querySelector(`.${CONFIG.badgeClass}`);
    if (existingBadge) {
      existingBadge.remove();
    }

    // Create badge
    const badge = document.createElement('span');
    badge.className = CONFIG.badgeClass;
    badge.textContent = formatTime(estimate.estimatedMinutes);
    badge.title = `Estimated time: ${formatTimeLong(estimate.estimatedMinutes)}`;

    // Style based on time
    if (estimate.estimatedMinutes >= 180) {
      badge.classList.add('high');
    } else if (estimate.estimatedMinutes >= 90) {
      badge.classList.add('medium');
    }

    // Find best place to inject
    const target = element.querySelector('.planner-item-link, .assignment-title, .ig-title') || element;

    // Insert after the title
    target.parentNode.insertBefore(badge, target.nextSibling);
  }

  /**
   * Format time in short form
   */
  function formatTime(minutes) {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  /**
   * Format time in long form
   */
  function formatTimeLong(minutes) {
    if (minutes < 60) {
      return `${minutes} minutes`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minutes`;
    }
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }

  /**
   * Observe DOM for dynamic content changes
   */
  function observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldUpdate = true;
          break;
        }
      }

      if (shouldUpdate) {
        // Debounce updates
        clearTimeout(observeDOMChanges.timeout);
        observeDOMChanges.timeout = setTimeout(injectTimeEstimates, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize
  init();
})();
