// Options page script for Download Router extension
class OptionsManager {
  constructor() {
    this.rules = [];
    this.editingIndex = -1;
    this.init();
  }

  async init() {
    await this.loadRules();
    this.setupEventListeners();
    this.setupTabs();
    this.renderRules();
  }
  generateRuleId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

  async loadRules() {
    try {
      const result = await chrome.storage.sync.get(['downloadRules']);
      this.rules = result.downloadRules || [];
    } catch (error) {
      console.error('Error loading rules:', error);
      this.showToast('Error loading rules', 'error');
      this.rules = [];
    }
  }

  async saveRules() {
    try {
      await chrome.storage.sync.set({ downloadRules: this.rules });
      this.showToast('Rules saved successfully', 'success');
    } catch (error) {
      console.error('Error saving rules:', error);
      this.showToast('Error saving rules', 'error');
    }
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Rule management
    document.getElementById('addRuleBtn').addEventListener('click', () => {
      this.openRuleModal();
    });

    document.getElementById('closeModal').addEventListener('click', () => {
      this.closeRuleModal();
    });

    document.getElementById('cancelRule').addEventListener('click', () => {
      this.closeRuleModal();
    });

    document.getElementById('saveRule').addEventListener('click', () => {
      this.saveRule();
    });

    // Import/Export
    document.getElementById('importRules').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('exportRules').addEventListener('click', () => {
      this.exportRules();
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
      this.importRules(e.target.files[0]);
    });

    // Modal overlay click
    document.getElementById('ruleModal').addEventListener('click', (e) => {
      if (e.target.id === 'ruleModal') {
        this.closeRuleModal();
      }
    });

    // Form submission
    document.getElementById('ruleForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveRule();
    });
  }

  setupTabs() {
    this.switchTab('rules');
  }

  switchTab(tabName) {
    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
  }

  renderRules(editruleId) {
    const container = document.getElementById('rulesContainer');
    
    if (this.rules.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No rules configured</h3>
          <p>Create your first rule to start organizing downloads automatically</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.rules.map((rule, index) => {
      const matchers = this.getActiveMatchers(rule);
      const matchersList = matchers.length > 0 
        ? matchers.map(m => `<span style="background: #dbeafe; color: #1d4ed8; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-right: 4px;">${m}</span>`).join('')
        : '<span style="color: #64748b; font-size: 12px;">No matchers configured</span>';

      return `
        <div class="rule-card">
          <div class="rule-header">
            <div style="flex: 1;">
              <div class="rule-name">${rule.name || `Rule ${index + 1}`}</div>
              <div style="color: #64748b; font-size: 14px; margin-top: 4px;">
                📁 ${rule.folder || 'No folder specified'}
              </div>
              <div style="margin-top: 8px;">${matchersList}</div>
            </div>
            <div class="rule-actions">
              <button class="button secondary small" id="rule_action_up_${rule.id}" ${index === 0 ? 'disabled' : ''}>
                ⬆️
              </button>
              <button class="button secondary small" id="rule_action_down_${rule.id}" ${index === this.rules.length - 1 ? 'disabled' : ''}>
                ⬇️
              </button>
              <button class="button secondary small" id="rule_action_edit_${rule.id}">
                ✏️ Edit
              </button>
              <button class="button danger small" id="rule_action_delete_${rule.id}">
                🗑️ Delete
              </button>
            </div>
          </div>
          ${this.renderRuleDetails(rule)}
        </div>
      `;
    }).join('');
    editruleId = editruleId || '';
    this.rules.map(rule => {
        if (editruleId!=rule.id){
            document.getElementById(`rule_action_up_${rule.id}`).onclick = () => {
                this.moveRuleUp(rule.id);
            }
            document.getElementById(`rule_action_down_${rule.id}`).onclick = () => {
                this.moveRuleDown(rule.id);
            }
            document.getElementById(`rule_action_edit_${rule.id}`).onclick = () => {
                this.editRule(rule.id);
            }
            document.getElementById(`rule_action_delete_${rule.id}`).onclick = () => {
                this.deleteRule(rule.id);
            }
        }
    })
  }
  

  renderRuleDetails(rule) {
    const details = [];
    if (rule.mimeType?.trim()) details.push(`<strong>MIME:</strong> ${rule.mimeType}`);
    if (rule.fileUrl?.trim()) details.push(`<strong>File URL:</strong> ${rule.fileUrl}`);
    if (rule.referrerUrl?.trim()) details.push(`<strong>Referrer:</strong> ${rule.referrerUrl}`);
    if (rule.filename?.trim()) details.push(`<strong>Filename:</strong> ${rule.filename}`);

    if (details.length === 0) {
      return '<div style="color: #64748b; font-size: 13px; font-style: italic;">This rule has no matchers and will never trigger.</div>';
    }

    return `
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-top: 12px; font-size: 13px; line-height: 1.6;">
        ${details.join('<br>')}
      </div>
    `;
  }

  getActiveMatchers(rule) {
    const matchers = [];
    if (rule.mimeType?.trim()) matchers.push('MIME');
    if (rule.fileUrl?.trim()) matchers.push('URL');
    if (rule.referrerUrl?.trim()) matchers.push('Referrer');
    if (rule.filename?.trim()) matchers.push('Filename');
    return matchers;
  }

  openRuleModal(rule = null, index = -1) {
    this.editingIndex = index;
    const modal = document.getElementById('ruleModal');
    const title = document.getElementById('modalTitle');
    
    title.textContent = index >= 0 ? 'Edit Rule' : 'Add New Rule';
    
    // Reset form
    document.getElementById('ruleForm').reset();
    
    if (rule) {
      document.getElementById('ruleId').value = rule.id || '';
      document.getElementById('ruleName').value = rule.name || '';
      document.getElementById('ruleFolder').value = rule.folder || '';
      document.getElementById('ruleMime').value = rule.mimeType || '';
      document.getElementById('ruleFileUrl').value = rule.fileUrl || '';
      document.getElementById('ruleReferrerUrl').value = rule.referrerUrl || '';
      document.getElementById('ruleFilename').value = rule.filename || '';
    }
    
    modal.classList.add('active');
    document.getElementById('ruleName').focus();
  }

  closeRuleModal() {
    const modal = document.getElementById('ruleModal');
    modal.classList.remove('active');
    this.editingIndex = -1;
  }

  async moveRuleUp(ruleId) {
    const index = this.rules.findIndex(rule => rule.id === ruleId);
    if (index > 0) {
      [this.rules[index - 1], this.rules[index]] = [this.rules[index], this.rules[index - 1]];
      await this.saveRules();
      this.renderRules();
    }
  }



  async moveRuleDown(ruleId) {
    const index = this.rules.findIndex(rule => rule.id === ruleId);
    if (index >= 0 && index < this.rules.length - 1) {
      [this.rules[index], this.rules[index + 1]] = [this.rules[index + 1], this.rules[index]];
      await this.saveRules();
      this.renderRules();
    }
  }

  async saveRule() {
    const form = document.getElementById('ruleForm');
    const formData = new FormData(form);
    const ruleId = document.getElementById('ruleId').value.trim()
    const rule = {
      id: ruleId!=''?ruleId:this.generateRuleId(),
      name: document.getElementById('ruleName').value.trim(),
      folder: document.getElementById('ruleFolder').value.trim(),
      mimeType: document.getElementById('ruleMime').value.trim(),
      fileUrl: document.getElementById('ruleFileUrl').value.trim(),
      referrerUrl: document.getElementById('ruleReferrerUrl').value.trim(),
      filename: document.getElementById('ruleFilename').value.trim()
    };

    // Validation
    if (!rule.folder) {
      this.showToast('Folder path is required', 'error');
      return;
    }

    const hasMatchers = rule.mimeType || rule.fileUrl || rule.referrerUrl || rule.filename;
    if (!hasMatchers) {
      this.showToast('At least one matcher must be specified', 'error');
      return;
    }

    // Validate regex patterns
    const patterns = [
      { value: rule.mimeType, name: 'MIME Type' },
      { value: rule.fileUrl, name: 'File URL' },
      { value: rule.referrerUrl, name: 'Referrer URL' },
      { value: rule.filename, name: 'Filename' }
    ];

    for (const pattern of patterns) {
      if (pattern.value && pattern.value.trim()) {
        try {
          new RegExp(pattern.value, 'i');
        } catch (error) {
          this.showToast(`Invalid regex in ${pattern.name}: ${error.message}`, 'error');
          return;
        }
      }
    }

    if (this.editingIndex >= 0) {
      this.rules[this.editingIndex] = rule;
    } else {
      this.rules.push(rule);
    }

    await this.saveRules();
    this.renderRules();
    this.closeRuleModal();
  }

  editRule(ruleId) {
    const index = this.rules.findIndex(rule => rule.id === ruleId);
    if (index!=undefined&& index >= 0 && index < this.rules.length) {
      this.openRuleModal(this.rules[index], index);
    }
  }

  async deleteRule(ruleId) {
    const index = this.rules.findIndex(rule => rule.id === ruleId);
    if (index!=undefined && index >= 0 && index < this.rules.length) {
      if (confirm('Are you sure you want to delete this rule?')) {
        this.rules.splice(index, 1);
        await this.saveRules();
        this.renderRules();
      }
    }
  }

  exportRules() {
    if (this.rules.length === 0) {
      this.showToast('No rules to export', 'error');
      return;
    }

    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      rules: this.rules
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `download-router-rules-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('Rules exported successfully', 'success');
  }

  async importRules(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate import data structure
      if (!data.rules || !Array.isArray(data.rules)) {
        throw new Error('Invalid file format: missing rules array');
      }

      // Validate each rule
      const validatedRules = data.rules.filter(rule => {
        if (!rule || typeof rule !== 'object') return false;
        if (!rule.folder || typeof rule.folder !== 'string') return false;
        
        // Check if at least one matcher exists
        const hasMatchers = rule.mimeType || rule.fileUrl || rule.referrerUrl || rule.filename;
        if (!hasMatchers) return false;

        // Validate regex patterns
        const patterns = [rule.mimeType, rule.fileUrl, rule.referrerUrl, rule.filename];
        for (const pattern of patterns) {
          if (pattern && pattern.trim()) {
            try {
              new RegExp(pattern, 'i');
            } catch (error) {
              return false;
            }
          }
        }

        return true;
      });

      if (validatedRules.length === 0) {
        throw new Error('No valid rules found in import file');
      }

      // Ask for confirmation if replacing existing rules
      let shouldReplace = true;
      if (this.rules.length > 0) {
        shouldReplace = confirm(
          `This will replace your ${this.rules.length} existing rule(s) with ${validatedRules.length} imported rule(s). Continue?`
        );
      }

      if (shouldReplace) {
        this.rules = validatedRules;
        await this.saveRules();
        this.renderRules();
        this.showToast(`Successfully imported ${validatedRules.length} rule(s)`, 'success');
      }

    } catch (error) {
      console.error('Import error:', error);
      this.showToast(`Import failed: ${error.message}`, 'error');
    }

    // Reset file input
    document.getElementById('fileInput').value = '';
  }

  showToast(message, type = 'success') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);

    // Hide toast
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});