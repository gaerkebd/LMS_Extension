/**
 * Utility Helper Functions
 * Common utilities used across the extension
 */

/**
 * Format a due date for display
 * @param {string|Date} dateInput - The due date
 * @returns {string} - Formatted date string
 */
export function formatDueDate(dateInput) {
  if (!dateInput) return 'No due date';

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Invalid date';

  const now = new Date();
  const diffMs = date - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Check if it's today
  if (isToday(date)) {
    return `Today at ${formatTime12Hour(date)}`;
  }

  // Check if it's tomorrow
  if (isTomorrow(date)) {
    return `Tomorrow at ${formatTime12Hour(date)}`;
  }

  // Within the next week
  if (diffDays > 0 && diffDays <= 7) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    return `${dayName} at ${formatTime12Hour(date)}`;
  }

  // More than a week away or in the past
  const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format time in 12-hour format
 * @param {Date} date - The date
 * @returns {string} - Time string (e.g., "3:30 PM")
 */
export function formatTime12Hour(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format estimated time for display
 * @param {number} minutes - Time in minutes
 * @returns {string} - Formatted time string
 */
export function formatTimeEstimate(minutes) {
  if (!minutes || minutes <= 0) return '—';

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  if (remainingMins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMins}m`;
}

/**
 * Format estimated time in long form
 * @param {number} minutes - Time in minutes
 * @returns {string} - Formatted time string (e.g., "2 hours 30 minutes")
 */
export function formatTimeEstimateLong(minutes) {
  if (!minutes || minutes <= 0) return 'Unknown';

  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  let result = `${hours} hour${hours !== 1 ? 's' : ''}`;
  if (remainingMins > 0) {
    result += ` ${remainingMins} minute${remainingMins !== 1 ? 's' : ''}`;
  }

  return result;
}

/**
 * Check if a date is today
 * @param {Date|string} dateInput - The date to check
 * @returns {boolean}
 */
export function isToday(dateInput) {
  const date = new Date(dateInput);
  const today = new Date();

  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

/**
 * Check if a date is tomorrow
 * @param {Date|string} dateInput - The date to check
 * @returns {boolean}
 */
export function isTomorrow(dateInput) {
  const date = new Date(dateInput);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return date.getDate() === tomorrow.getDate() &&
         date.getMonth() === tomorrow.getMonth() &&
         date.getFullYear() === tomorrow.getFullYear();
}

/**
 * Check if an assignment is due today
 * @param {string|Date} dueDate - The due date
 * @returns {boolean}
 */
export function isDueToday(dueDate) {
  return isToday(dueDate);
}

/**
 * Check if an assignment is urgent (due within 24 hours)
 * @param {string|Date} dueDate - The due date
 * @returns {boolean}
 */
export function isUrgent(dueDate) {
  if (!dueDate) return false;

  const date = new Date(dueDate);
  const now = new Date();
  const hoursUntilDue = (date - now) / (1000 * 60 * 60);

  return hoursUntilDue > 0 && hoursUntilDue <= 24;
}

/**
 * Check if an assignment is overdue
 * @param {string|Date} dueDate - The due date
 * @returns {boolean}
 */
export function isOverdue(dueDate) {
  if (!dueDate) return false;

  const date = new Date(dueDate);
  const now = new Date();

  return date < now;
}

/**
 * Get the relative urgency level of an assignment
 * @param {string|Date} dueDate - The due date
 * @returns {'overdue'|'urgent'|'soon'|'normal'|'none'}
 */
export function getUrgencyLevel(dueDate) {
  if (!dueDate) return 'none';

  const date = new Date(dueDate);
  const now = new Date();
  const hoursUntilDue = (date - now) / (1000 * 60 * 60);

  if (hoursUntilDue < 0) return 'overdue';
  if (hoursUntilDue <= 24) return 'urgent';
  if (hoursUntilDue <= 72) return 'soon';
  return 'normal';
}

/**
 * Calculate total time from an array of assignments
 * @param {Array} assignments - Array of assignment objects with estimatedMinutes
 * @returns {number} - Total minutes
 */
export function calculateTotalTime(assignments) {
  return assignments.reduce((sum, a) => sum + (a.estimatedMinutes || 0), 0);
}

/**
 * Group assignments by date
 * @param {Array} assignments - Array of assignment objects
 * @returns {Object} - Grouped assignments by date key
 */
export function groupByDate(assignments) {
  const groups = {};

  for (const assignment of assignments) {
    if (!assignment.dueDate) {
      const key = 'no-date';
      groups[key] = groups[key] || [];
      groups[key].push(assignment);
      continue;
    }

    const date = new Date(assignment.dueDate);
    const key = date.toISOString().split('T')[0]; // YYYY-MM-DD

    groups[key] = groups[key] || [];
    groups[key].push(assignment);
  }

  return groups;
}

/**
 * Group assignments by course
 * @param {Array} assignments - Array of assignment objects
 * @returns {Object} - Grouped assignments by course name
 */
export function groupByCourse(assignments) {
  const groups = {};

  for (const assignment of assignments) {
    const key = assignment.courseName || 'Unknown Course';
    groups[key] = groups[key] || [];
    groups[key].push(assignment);
  }

  return groups;
}

/**
 * Sort assignments by due date
 * @param {Array} assignments - Array of assignment objects
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} - Sorted assignments
 */
export function sortByDueDate(assignments, order = 'asc') {
  return [...assignments].sort((a, b) => {
    const dateA = new Date(a.dueDate || '9999-12-31');
    const dateB = new Date(b.dueDate || '9999-12-31');
    return order === 'asc' ? dateA - dateB : dateB - dateA;
  });
}

/**
 * Sort assignments by estimated time
 * @param {Array} assignments - Array of assignment objects
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} - Sorted assignments
 */
export function sortByEstimatedTime(assignments, order = 'desc') {
  return [...assignments].sort((a, b) => {
    const timeA = a.estimatedMinutes || 0;
    const timeB = b.estimatedMinutes || 0;
    return order === 'asc' ? timeA - timeB : timeB - timeA;
  });
}

/**
 * Debounce a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Strip HTML tags from text
 * @param {string} html - HTML string
 * @returns {string} - Plain text
 */
export function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add if truncated
 * @returns {string} - Truncated text
 */
export function truncate(text, maxLength, suffix = '...') {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Generate a unique ID
 * @returns {string} - Unique ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} - Cloned object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if we're on a Canvas page
 * @returns {boolean}
 */
export function isCanvasPage() {
  return window.location.hostname.includes('instructure.com');
}

/**
 * Get Canvas base URL from current page
 * @returns {string|null}
 */
export function getCanvasBaseUrl() {
  if (!isCanvasPage()) return null;
  return `${window.location.protocol}//${window.location.hostname}`;
}
