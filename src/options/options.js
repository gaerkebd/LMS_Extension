/**
 * Options Page Script
 * Handles settings management for the Canvas Time Estimator extension
 */

class OptionsController {
  constructor() {
    this.initElements();
    this.attachEventListeners();
    this.loadSettings();
  }

  initElements() {
    this.elements = {
      // Canvas settings
      canvasUrl: document.getElementById('canvas-url'),
      apiToken: document.getElementById('api-token'),
      toggleToken: document.getElementById('toggle-token'),
      testConnection: document.getElementById('test-connection'),
      connectionStatus: document.getElementById('connection-status'),

      // AI settings
      aiProvider: document.getElementById('ai-provider'),
      openaiConfig: document.getElementById('openai-config'),
      anthropicConfig: document.getElementById('anthropic-config'),
      modelConfig: document.getElementById('model-config'),
      openaiKey: document.getElementById('openai-key'),
      anthropicKey: document.getElementById('anthropic-key'),
      estimationModel: document.getElementById('estimation-model'),

      // Notification settings
      showNotifications: document.getElementById('show-notifications'),
      refreshInterval: document.getElementById('refresh-interval'),

      // Data management
      clearCache: document.getElementById('clear-cache'),
      exportData: document.getElementById('export-data'),
      importData: document.getElementById('import-data'),
      importFile: document.getElementById('import-file'),

      // Save
      saveSettings: document.getElementById('save-settings'),
      saveStatus: document.getElementById('save-status'),

      // Modal
      tokenHelpLink: document.getElementById('token-help-link'),
      tokenModal: document.getElementById('token-modal'),
      closeModal: document.getElementById('close-modal')
    };
  }

  attachEventListeners() {
    // Toggle password visibility
    this.elements.toggleToken.addEventListener('click', () => {
      this.toggleVisibility(this.elements.apiToken);
    });

    document.querySelectorAll('.toggle-visibility').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const input = e.target.closest('.input-with-button').querySelector('input');
        this.toggleVisibility(input);
      });
    });

    // Test connection
    this.elements.testConnection.addEventListener('click', () => this.testConnection());

    // AI provider change
    this.elements.aiProvider.addEventListener('change', () => this.handleAIProviderChange());

    // Data management
    this.elements.clearCache.addEventListener('click', () => this.clearCache());
    this.elements.exportData.addEventListener('click', () => this.exportSettings());
    this.elements.importData.addEventListener('click', () => this.elements.importFile.click());
    this.elements.importFile.addEventListener('change', (e) => this.importSettings(e));

    // Save settings
    this.elements.saveSettings.addEventListener('click', () => this.saveSettings());

    // Modal
    this.elements.tokenHelpLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.elements.tokenModal.style.display = 'flex';
    });

    this.elements.closeModal.addEventListener('click', () => {
      this.elements.tokenModal.style.display = 'none';
    });

    this.elements.tokenModal.addEventListener('click', (e) => {
      if (e.target === this.elements.tokenModal) {
        this.elements.tokenModal.style.display = 'none';
      }
    });
  }

  toggleVisibility(input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get([
        'canvasUrl',
        'apiToken',
        'aiProvider',
        'openaiApiKey',
        'anthropicApiKey',
        'estimationModel',
        'showNotifications',
        'refreshInterval'
      ]);

      this.elements.canvasUrl.value = settings.canvasUrl || '';
      this.elements.apiToken.value = settings.apiToken || '';
      this.elements.aiProvider.value = settings.aiProvider || 'none';
      this.elements.openaiKey.value = settings.openaiApiKey || '';
      this.elements.anthropicKey.value = settings.anthropicApiKey || '';
      this.elements.estimationModel.value = settings.estimationModel || 'gpt-3.5-turbo';
      this.elements.showNotifications.checked = settings.showNotifications !== false;
      this.elements.refreshInterval.value = settings.refreshInterval || 30;

      this.handleAIProviderChange();
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showStatus(this.elements.saveStatus, 'Error loading settings', 'error');
    }
  }

  handleAIProviderChange() {
    const provider = this.elements.aiProvider.value;

    // Hide all AI configs
    this.elements.openaiConfig.style.display = 'none';
    this.elements.anthropicConfig.style.display = 'none';
    this.elements.modelConfig.style.display = 'none';

    // Show relevant config
    if (provider === 'openai') {
      this.elements.openaiConfig.style.display = 'block';
      this.elements.modelConfig.style.display = 'block';
    } else if (provider === 'anthropic') {
      this.elements.anthropicConfig.style.display = 'block';
    }
  }

  async testConnection() {
    const url = this.elements.canvasUrl.value.trim();
    const token = this.elements.apiToken.value.trim();

    if (!url || !token) {
      this.showStatus(this.elements.connectionStatus, 'Please enter URL and token', 'error');
      return;
    }

    this.showStatus(this.elements.connectionStatus, 'Testing...', 'loading');
    this.elements.testConnection.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_CONNECTION',
        url,
        token
      });

      if (response.success) {
        this.showStatus(this.elements.connectionStatus, '✓ Connected successfully!', 'success');
      } else {
        this.showStatus(this.elements.connectionStatus, '✗ Connection failed', 'error');
      }
    } catch (error) {
      this.showStatus(this.elements.connectionStatus, '✗ Error: ' + error.message, 'error');
    }

    this.elements.testConnection.disabled = false;
  }

  async saveSettings() {
    const settings = {
      canvasUrl: this.elements.canvasUrl.value.trim(),
      apiToken: this.elements.apiToken.value.trim(),
      aiProvider: this.elements.aiProvider.value,
      openaiApiKey: this.elements.openaiKey.value.trim(),
      anthropicApiKey: this.elements.anthropicKey.value.trim(),
      estimationModel: this.elements.estimationModel.value,
      showNotifications: this.elements.showNotifications.checked,
      refreshInterval: parseInt(this.elements.refreshInterval.value)
    };

    try {
      await chrome.storage.sync.set(settings);
      this.showStatus(this.elements.saveStatus, '✓ Settings saved!', 'success');

      // Update alarm interval if changed
      await chrome.alarms.clear('refresh-assignments');
      await chrome.alarms.create('refresh-assignments', {
        periodInMinutes: settings.refreshInterval
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showStatus(this.elements.saveStatus, '✗ Error saving settings', 'error');
    }
  }

  async clearCache() {
    if (!confirm('Are you sure you want to clear all cached assignment data?')) {
      return;
    }

    try {
      await chrome.storage.local.clear();
      alert('Cache cleared successfully!');
    } catch (error) {
      alert('Error clearing cache: ' + error.message);
    }
  }

  async exportSettings() {
    try {
      const syncData = await chrome.storage.sync.get(null);
      const exportData = {
        ...syncData,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
      };

      // Remove sensitive data
      delete exportData.apiToken;
      delete exportData.openaiApiKey;
      delete exportData.anthropicApiKey;

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `canvas-time-estimator-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Error exporting settings: ' + error.message);
    }
  }

  async importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate import data
      if (!data.version) {
        throw new Error('Invalid settings file');
      }

      // Remove metadata
      delete data.exportDate;
      delete data.version;

      await chrome.storage.sync.set(data);
      await this.loadSettings();

      alert('Settings imported successfully! Note: API tokens were not imported for security.');
    } catch (error) {
      alert('Error importing settings: ' + error.message);
    }

    // Reset file input
    event.target.value = '';
  }

  showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status-message ${type}`;

    if (type === 'success') {
      setTimeout(() => {
        element.textContent = '';
        element.className = 'status-message';
      }, 3000);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});
