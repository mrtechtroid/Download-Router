// Background script for Download Router extension

class DownloadRouter {
  constructor() {
    this.rules = [];
    this.loadRules();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for download events
    chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
      this.handleDownload(downloadItem, suggest);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes.downloadRules) {
        this.rules = changes.downloadRules.newValue || [];
      }
    });

    // Handle installation
    chrome.runtime.onInstalled.addListener(() => {
      this.initializeStorage();
    });
  }

  async initializeStorage() {
    const result = await chrome.storage.sync.get(['downloadRules']);
    if (!result.downloadRules) {
      await chrome.storage.sync.set({
        downloadRules: []
      });
    }
  }

  handleDownload(downloadItem, suggest) {
    let suggestion;
    try {
      const rules = this.rules;
      const matchingRule = this.findMatchingRule(downloadItem, rules);
      console.log(downloadItem, matchingRule);
      if (matchingRule && matchingRule.folder) {
        const filename = downloadItem.filename || 'download';
        const newPath = `${matchingRule.folder}/${filename}`;
        suggestion = { filename: newPath };
      }
    } catch (error) {
      console.error('Download Router Error:', error);
    } finally {
        console.log(suggestion)
        suggest(suggestion)
    }
  }
  async loadRules(){
    this.rules = await this.getRules() || [];
  }
  async getRules() {
    const result = await chrome.storage.sync.get(['downloadRules']);
    return result.downloadRules || [];
  }

  findMatchingRule(downloadItem, rules) {
    // Get current tab info for referrer
    const referrerUrl = downloadItem.referrer || '';

    for (const rule of rules) {
      if (this.matchesRule(downloadItem, rule, referrerUrl)) {
        return rule;
      }
    }
    return null;
  }

  matchesRule(downloadItem, rule, referrerUrl) {
    const tests = [];

    // MIME type matcher
    if (rule.mimeType && rule.mimeType.trim()) {
      if (rule.mimeType[0] === '='){
        tests.push(downloadItem.mime === rule.mimeType.slice(1));
      }else{
        const mimeRegex = new RegExp(rule.mimeType, 'i');
        tests.push(mimeRegex.test(downloadItem.mime || ''));
      }
    }

    // File URL matcher
    if (rule.fileUrl && rule.fileUrl.trim()) {
      if (rule.fileUrl[0] === '='){
        tests.push(downloadItem.url === rule.fileUrl.slice(1));
      }else{
        const urlRegex = new RegExp(rule.fileUrl, 'i');
        tests.push(urlRegex.test(downloadItem.url || ''));
      }
    }

    // Referrer URL matcher
    if (rule.referrerUrl && rule.referrerUrl.trim()) {
        if (rule.referrerUrl[0] === '='){
          tests.push(referrerUrl === rule.referrerUrl.slice(1));
        }else{
          const referrerRegex = new RegExp(rule.referrerUrl, 'i');
          tests.push(referrerRegex.test(referrerUrl));
        }
    }

    // Filename matcher
    if (rule.filename && rule.filename.trim()) {
        if (rule.filename[0] === '='){
          tests.push(downloadItem.filename === rule.filename.slice(1));
        }else if (rule.filename[0] === '~'){
            const fileExtension = downloadItem.filename.split('.').pop()?.toLowerCase();
            tests.push(fileExtension === rule.filename.slice(1));
        }else{
          const filenameRegex = new RegExp(rule.filename, 'i');
          const filename = downloadItem.filename || '';
          tests.push(filenameRegex.test(filename));
        }       
    }

    // All non-empty matchers must pass (AND logic)
    return tests.length > 0 && tests.every(test => test);
  }
}

// Initialize the download router
new DownloadRouter();