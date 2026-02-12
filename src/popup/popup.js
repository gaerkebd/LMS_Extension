/**
 * Popup Script
 * Handles the main popup UI for the Canvas Time Estimator extension
 */

import { CanvasAPI } from '../services/canvas-api.js';
import { TimeEstimator } from '../services/time-estimator.js';
import { formatDueDate, formatTimeEstimate, isUrgent, isDueToday } from '../utils/helpers.js';

class PopupController {
  constructor() {
    this.canvasAPI = new CanvasAPI();
    this.timeEstimator = new TimeEstimator();
    this.assignments = [];

    this.initElements();
    this.attachEventListeners();
    this.initialize();
  }

  initElements() {
    this.elements = {
      connectionStatus: document.getElementById('connection-status'),
      statusText: document.querySelector('.status-text'),
      totalAssignments: document.getElementById('total-assignments'),
      totalTime: document.getElementById('total-time'),
      dueToday: document.getElementById('due-today'),
      assignmentsList: document.getElementById('assignments-list'),
      refreshBtn: document.getElementById('refresh-btn'),
      openOptions: document.getElementById('open-options'),
      viewCanvas: document.getElementById('view-canvas'),
    };
  }

  attachEventListeners() {
    this.elements.refreshBtn.addEventListener('click', () => this.refreshAssignments());
    this.elements.openOptions.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
    this.elements.viewCanvas.addEventListener('click', (e) => {
      e.preventDefault();
      this.openCanvas();
    });
  }

  async initialize() {
    await this.checkConnection();
    await this.loadAssignments();
  }

  async checkConnection() {
    try {
      const settings = await chrome.storage.sync.get(['canvasUrl', 'apiToken']);

      if (!settings.canvasUrl || !settings.apiToken) {
        this.setConnectionStatus('error', 'Please configure settings');
        return false;
      }

      this.canvasAPI.configure(settings.canvasUrl, settings.apiToken);
      const isConnected = await this.canvasAPI.testConnection();

      if (isConnected) {
        this.setConnectionStatus('connected', 'Connected to Canvas');
        return true;
      } else {
        this.setConnectionStatus('error', 'Connection failed');
        return false;
      }
    } catch (error) {
      this.setConnectionStatus('error', 'Connection error');
      return false;
    }
  }

  setConnectionStatus(status, text) {
    this.elements.connectionStatus.className = `status-bar ${status}`;
    this.elements.statusText.textContent = text;
  }

  async loadAssignments() {
    try {
      this.showLoading();

      const settings = await chrome.storage.sync.get(['canvasUrl', 'apiToken']);
      if (!settings.canvasUrl || !settings.apiToken) {
        this.showConfigNeeded();
        return;
      }

      // Fetch assignments from Canvas
      const rawAssignments = await this.canvasAPI.getTodoItems();

      if (rawAssignments.length === 0) {
        this.showEmptyState();
        return;
      }

      // Get time estimates for each assignment
      this.assignments = await this.timeEstimator.estimateAll(rawAssignments);

      // Update UI
      this.updateSummary();
      this.renderAssignments();

      // Cache results
      await chrome.storage.local.set({
        cachedAssignments: this.assignments,
        lastUpdated: Date.now()
      });

    } catch (error) {
      console.error('Error loading assignments:', error);
      this.showError(error.message);
    }
  }

  async refreshAssignments() {
    this.elements.refreshBtn.disabled = true;
    this.elements.refreshBtn.style.opacity = '0.5';

    await this.loadAssignments();

    this.elements.refreshBtn.disabled = false;
    this.elements.refreshBtn.style.opacity = '1';
  }

  updateSummary() {
    const dueTodayCount = this.assignments.filter(a => isDueToday(a.dueDate)).length;
    const totalMinutes = this.assignments.reduce((sum, a) => sum + (a.estimatedMinutes || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    this.elements.totalAssignments.textContent = this.assignments.length;
    this.elements.totalTime.textContent = totalHours;
    this.elements.dueToday.textContent = dueTodayCount;
  }

  renderAssignments() {
    if (this.assignments.length === 0) {
      this.showEmptyState();
      return;
    }

    // Sort by due date
    const sorted = [...this.assignments].sort((a, b) =>
      new Date(a.dueDate) - new Date(b.dueDate)
    );

    this.elements.assignmentsList.innerHTML = sorted
      .map(assignment => this.createAssignmentCard(assignment))
      .join('');
  }

  createAssignmentCard(assignment) {
    const urgent = isUrgent(assignment.dueDate);
    const timeClass = this.getTimeClass(assignment.estimatedMinutes);

    return `
      <div class="assignment-card" data-id="${assignment.id}">
        <div class="assignment-header">
          <div>
            <div class="assignment-title">${this.escapeHtml(assignment.title)}</div>
            <div class="assignment-course">${this.escapeHtml(assignment.courseName)}</div>
          </div>
          <span class="time-estimate ${timeClass}">
            ${formatTimeEstimate(assignment.estimatedMinutes)}
          </span>
        </div>
        <div class="assignment-meta">
          <span class="due-date ${urgent ? 'urgent' : ''}">
            📅 ${formatDueDate(assignment.dueDate)}
          </span>
          <span class="assignment-type">${assignment.type || 'assignment'}</span>
        </div>
      </div>
    `;
  }

  getTimeClass(minutes) {
    if (minutes >= 180) return 'very-high';
    if (minutes >= 90) return 'high';
    return '';
  }

  showLoading() {
    this.elements.assignmentsList.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Loading assignments...</p>
      </div>
    `;
  }

  showEmptyState() {
    this.elements.assignmentsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎉</div>
        <p>No upcoming assignments!</p>
        <p style="font-size: 12px; margin-top: 8px;">Enjoy your free time.</p>
      </div>
    `;
    this.elements.totalAssignments.textContent = '0';
    this.elements.totalTime.textContent = '0';
    this.elements.dueToday.textContent = '0';
  }

  showConfigNeeded() {
    this.elements.assignmentsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚙️</div>
        <p>Setup Required</p>
        <p style="font-size: 12px; margin-top: 8px;">
          Please configure your Canvas URL and API token in settings.
        </p>
        <button onclick="chrome.runtime.openOptionsPage()" style="
          margin-top: 12px;
          padding: 8px 16px;
          background: #e63946;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        ">Open Settings</button>
      </div>
    `;
  }

  showError(message) {
    this.elements.assignmentsList.innerHTML = `
      <div class="error-state">
        <p>❌ Error loading assignments</p>
        <p style="font-size: 12px; margin-top: 4px;">${this.escapeHtml(message)}</p>
        <button onclick="location.reload()">Try Again</button>
      </div>
    `;
  }

  async openCanvas() {
    const settings = await chrome.storage.sync.get(['canvasUrl']);
    const url = settings.canvasUrl || 'https://canvas.instructure.com';
    chrome.tabs.create({ url });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
