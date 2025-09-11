// Popup script for Download Router extension

class PopupManager {
  constructor() {
    this.currentTab = null;
    this.rules = [];
    this.init();
  }

  async init() {
    await this.loadCurrentTab();
    await this.loadRules();
    this.setupEventListeners();
    this.render();
  }

  async loadCurrentTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tabs[0];
    } catch (error) {
      console.error('Error loading current tab:', error);
    }
  }

  async loadRules() {
    try {
      const result = await chrome.storage.sync.get(['downloadRules']);
      this.rules = result.downloadRules || [];
    } catch (error) {
      console.error('Error loading rules:', error);
      this.rules = [];
    }
  }

  setupEventListeners() {
    document.getElementById('openOptions').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  getMatchingRules() {
    if (!this.currentTab) return [];

    const currentUrl = this.currentTab.url;
    const matchingRules = [];

    for (const rule of this.rules) {
      if (this.wouldRuleMatch(rule, currentUrl)) {
        matchingRules.push(rule);
      }
    }

    return matchingRules;
  }

  wouldRuleMatch(rule, referrerUrl) {
    // Check if referrer URL matcher would match (this is the most relevant for popup)
    if (rule.referrerUrl && rule.referrerUrl.trim()) {
      try {
        if (rule.referrerUrl[0] === '='){
          return referrerUrl === rule.referrerUrl.slice(1);
        }else{
          const referrerRegex = new RegExp(rule.referrerUrl, 'i');
          return referrerRegex.test(referrerUrl);
        }
      } catch (error) {
        console.error('Invalid regex in rule:', rule.referrerUrl);
        return false;
      }
    }
    
    // If no referrer URL matcher, this rule could potentially match
    return Object.values(rule).some(value => value && value.toString().trim());
  }

  getActiveMatchers(rule) {
    const matchers = [];
    if (rule.mimeType?.trim()) matchers.push('MIME');
    if (rule.fileUrl?.trim()) matchers.push('URL');
    if (rule.referrerUrl?.trim()) matchers.push('Referrer');
    if (rule.filename?.trim()) matchers.push('Filename');
    return matchers;
  }

  render() {
    this.renderCurrentSite();
    this.renderRules();
  }

  renderCurrentSite() {
    const urlElement = document.getElementById('currentUrl');
    const siteUrlElement = document.getElementById('siteUrl');
    
    if (this.currentTab) {
      const url = new URL(this.currentTab.url);
      urlElement.textContent = url.hostname;
      siteUrlElement.textContent = this.currentTab.url;
    } else {
      urlElement.textContent = 'No active tab';
      siteUrlElement.textContent = '-';
    }
  }

  renderRules() {
    const container = document.getElementById('rulesContainer');
    const matchingRules = this.getMatchingRules();

    if (matchingRules.length === 0) {
      container.innerHTML = `
        <div class="no-rules">
          No rules match the current site.<br>
          <small>Rules with referrer URL patterns that match this site will appear here.</small>
        </div>
      `;
      return;
    }

    container.innerHTML = matchingRules.map((rule, index) => {
      const matchers = this.getActiveMatchers(rule);
      const matcherTags = matchers.map(m => `<span class="matcher-tag">${m}</span>`).join('');
      
      return `
        <div class="rule-item">
          <div class="rule-name">${rule.name || `Rule ${index + 1}`}</div>
          <div class="rule-folder">📁 ${rule.folder || 'Default'}</div>
          <div class="rule-matchers">${matcherTags}</div>
        </div>
      `;
    }).join('');
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});