/**
 * Top Toolbar Component
 * Controls: New Paper, Load Sample, Save/Open JSON, Download PDF/DOCX, Backend Status, Save Status
 */

import { store } from '../state.js';
import { ApiService } from '../api.js';
import { ModalService } from './modal.js';
import { FileIOService } from '../utils/fileIO.js';

export class ToolbarComponent {
  constructor(containerEl) {
    this.container = containerEl;
    this.exportFormat = localStorage.getItem('qp_export_format') || 'pdf';
    this.render();
    this.bindEvents();
    store.subscribe((event, state, payload) => this.onStateChange(event, payload));
  }

  render() {
    const isDocx = this.exportFormat === 'docx';
    const exportBtnLabel = isDocx ? 'Download Word' : 'Download PDF';

    this.container.innerHTML = `
      <div class="brand-section">
        <div class="brand-logo" title="Question Paper Alignment Software">
          <span>🎓</span>
        </div>
        <div class="brand-titles">
          <div class="brand-name">QP Alignment Software</div>
          <div class="brand-tagline">CBSE &amp; ICSE Format Exam Paper Editor</div>
        </div>
      </div>

      <div class="toolbar-actions">
        <!-- Status Badges -->
        <button id="btn-backend-status" class="status-pill status-backend-offline btn-secondary" title="Click to configure backend API connection">
          <span class="status-dot"></span>
          <span id="backend-status-text">Backend: Checking...</span>
        </button>

        <span id="save-status-pill" class="status-pill status-saved">
          <span class="status-dot"></span>
          <span id="save-status-text">Saved</span>
        </span>

        <div class="toolbar-divider"></div>

        <!-- Action Buttons -->
        <button id="btn-new-paper" class="btn btn-secondary btn-sm" title="Create a new blank question paper">
          <span>📝</span>
          <span>New</span>
        </button>

        <button id="btn-load-sample" class="btn btn-secondary btn-sm" title="Load Class VII Social Science sample paper">
          <span>📄</span>
          <span>Sample</span>
        </button>

        <button id="btn-save-json" class="btn btn-secondary btn-sm" title="Download paper as JSON file">
          <span>💾</span>
          <span>Save JSON</span>
        </button>

        <button id="btn-open-json" class="btn btn-secondary btn-sm" title="Open and restore paper from JSON file">
          <span>📂</span>
          <span>Open JSON</span>
        </button>
        <input type="file" id="file-input-open-json" accept=".json,application/json" style="display: none;" />

        <div class="toolbar-divider"></div>

        <!-- Export Format Selector & Download Button -->
        <div style="display: flex; align-items: center; gap: 4px;">
          <select id="select-export-format" class="form-control form-control-sm" style="width: auto; font-weight: 500; height: 32px; padding: 2px 8px;" title="Choose export document format">
            <option value="pdf" ${!isDocx ? 'selected' : ''}>PDF (.pdf)</option>
            <option value="docx" ${isDocx ? 'selected' : ''}>Word (.docx)</option>
          </select>

          <button id="btn-download-export" class="btn btn-primary btn-sm" title="Generate and download formatted document">
            <span id="export-icon">⬇</span>
            <span id="export-btn-text">${exportBtnLabel}</span>
          </button>
        </div>

        <button id="btn-print-preview" class="btn btn-secondary btn-sm" title="Print or Save as PDF using browser dialog">
          <span>🖨️</span>
          <span>Print</span>
        </button>
      </div>
    `;
  }

  bindEvents() {
    const btnNewPaper = this.container.querySelector('#btn-new-paper');
    const btnSample = this.container.querySelector('#btn-load-sample');
    const btnSaveJson = this.container.querySelector('#btn-save-json');
    const btnOpenJson = this.container.querySelector('#btn-open-json');
    const fileInputOpen = this.container.querySelector('#file-input-open-json');
    const formatSelect = this.container.querySelector('#select-export-format');
    const btnExport = this.container.querySelector('#btn-download-export');
    const btnPrint = this.container.querySelector('#btn-print-preview');
    const btnBackend = this.container.querySelector('#btn-backend-status');

    // New Paper
    btnNewPaper.addEventListener('click', () => {
      const handleConfirm = () => {
        store.clearPaper();
        ModalService.toast('New blank question paper created!', 'info');
      };

      if (typeof window.confirm === 'function' && !window.confirm.toString().includes('[native code]')) {
        if (window.confirm('Are you sure you want to create a new question paper?')) {
          handleConfirm();
        }
        return;
      }

      ModalService.confirm({
        title: 'Create New Question Paper?',
        message: 'Are you sure you want to create a new question paper? All current headers, sections, and questions will be cleared.',
        confirmText: 'Confirm',
        confirmClass: 'btn-primary',
        onConfirm: handleConfirm
      });
    });

    // Load Sample
    btnSample.addEventListener('click', () => {
      ModalService.confirm({
        title: 'Load Sample Examination Paper?',
        message: 'Loading the Class VII Social Science sample paper will replace the current paper in the editor. Unsaved changes will be overwritten.',
        confirmText: 'Load Sample',
        confirmClass: 'btn-primary',
        onConfirm: () => {
          store.resetToSample();
          ModalService.toast('Class VII Social Science sample loaded!', 'success');
        }
      });
    });

    // Save JSON
    btnSaveJson.addEventListener('click', () => {
      const res = FileIOService.exportPaper(store.paper);
      if (res.success) {
        ModalService.toast(`Saved JSON file: ${res.filename}`, 'success');
      } else {
        ModalService.toast(`Failed to save JSON: ${res.error}`, 'error');
      }
    });

    // Open JSON
    btnOpenJson.addEventListener('click', () => {
      fileInputOpen.click();
    });

    fileInputOpen.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const res = await FileIOService.importPaperFromFile(file);
      fileInputOpen.value = '';
      if (res.success) {
        store.loadPaper(res.paper);
        ModalService.toast(`Successfully imported ${file.name}`, 'success');
      } else {
        let msg = res.error || 'Failed to import JSON file.';
        if (res.validationErrors && res.validationErrors.length) {
          msg += `\n${res.validationErrors.join('\n')}`;
        }
        ModalService.showModal({
          title: 'Invalid Question Paper File',
          contentHtml: `<p style="font-size: 13px;">${msg.replace(/\n/g, '<br>')}</p>`,
          buttons: [{ text: 'Close', className: 'btn-secondary' }]
        });
      }
    });

    // Format Selector Change
    formatSelect.addEventListener('change', (e) => {
      this.exportFormat = e.target.value;
      localStorage.setItem('qp_export_format', this.exportFormat);
      const btnText = this.container.querySelector('#export-btn-text');
      if (btnText) {
        btnText.textContent = this.exportFormat === 'docx' ? 'Download Word' : 'Download PDF';
      }
    });

    // Download Export (PDF or Word)
    btnExport.addEventListener('click', async () => {
      const btnText = this.container.querySelector('#export-btn-text');
      const icon = this.container.querySelector('#export-icon');
      const formatName = this.exportFormat.toUpperCase();

      btnExport.disabled = true;
      btnText.textContent = `Generating ${formatName}...`;
      icon.textContent = '⏳';

      const res = await ApiService.downloadPaper(store.paper, this.exportFormat);

      btnExport.disabled = false;
      btnText.textContent = this.exportFormat === 'docx' ? 'Download Word' : 'Download PDF';
      icon.textContent = '⬇';

      if (res.success) {
        ModalService.toast(`${formatName} downloaded to your Downloads folder: ${res.filename}`, 'success');
      } else {
        ModalService.showModal({
          title: `${formatName} Generation Error`,
          contentHtml: `
            <div style="font-size: var(--font-size-sm); color: var(--color-text-body); display: flex; flex-direction: column; gap: 12px;">
              <p>The backend was unable to generate the ${formatName} file.</p>
              <div style="background: var(--color-danger-bg); border: 1px solid var(--color-danger-border); color: var(--color-danger-text); padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; word-break: break-word; white-space: pre-wrap;">
                ${res.error}
              </div>
              <p style="font-size: 13px; color: var(--color-text-muted);">
                <strong>Alternative:</strong> You can click the <strong>"Print"</strong> button in the top toolbar to save or print the examination paper directly as an A4 PDF using your browser's native print engine.
              </p>
            </div>
          `,
          buttons: [
            {
              text: 'Print via Browser',
              className: 'btn-primary',
              onClick: () => {
                this.triggerBrowserPrint();
              }
            },
            { text: 'Close', className: 'btn-secondary' }
          ]
        });
      }
    });

    // Print Preview
    btnPrint.addEventListener('click', () => {
      this.triggerBrowserPrint();
    });

    // Backend Config Modal
    btnBackend.addEventListener('click', () => {
      this.openBackendConfigModal();
    });
  }

  triggerBrowserPrint() {
    const iframe = document.querySelector('.preview-iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        window.print();
      }
    } else {
      window.print();
    }
  }

  openBackendConfigModal() {
    const currentUrl = ApiService.getBaseUrl();
    const isOnline = store.backendStatus === 'online';

    ModalService.showModal({
      title: 'Backend API Connection Settings',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px; font-size: var(--font-size-sm);">
          <p style="color: var(--color-text-body);">
            The software connects to the FastAPI backend for authoritative HTML paper preview and PDF/DOCX rendering.
          </p>
          <div class="form-group">
            <label class="form-label">Backend Base URL</label>
            <input type="text" id="input-backend-url" class="form-control" value="${currentUrl}" placeholder="http://127.0.0.1:8000" />
            <span class="form-hint">Default local address: http://127.0.0.1:8000</span>
          </div>
          <div style="background: var(--color-surface-muted); padding: 10px 14px; border-radius: 6px; border: 1px solid var(--color-border-subtle);">
            <strong>Current Status:</strong>
            <span style="color: ${isOnline ? 'var(--color-success-solid)' : 'var(--color-warning-solid)'}; font-weight: bold; margin-left: 6px;">
              ${isOnline ? '● Connected' : '○ Offline / Demo Mode Active'}
            </span>
          </div>
        </div>
      `,
      buttons: [
        { text: 'Cancel', className: 'btn-secondary' },
        {
          text: 'Save & Test Connection',
          className: 'btn-primary',
          onClick: async (bodyEl) => {
            const input = bodyEl.querySelector('#input-backend-url');
            if (input && input.value.trim()) {
              ApiService.setBaseUrl(input.value.trim());
              const health = await ApiService.checkHealth();
              store.backendStatus = health.isOnline ? 'online' : 'offline';
              store.notify('backend_status_change');
              if (health.isOnline) {
                ModalService.toast('Connected to backend successfully!', 'success');
              } else {
                ModalService.toast('Backend is unreachable. Demo/Client mode active.', 'warning');
              }
            }
          }
        }
      ]
    });
  }

  onStateChange(event, payload) {
    if (event === 'dirty_state') {
      const pill = this.container.querySelector('#save-status-pill');
      const text = this.container.querySelector('#save-status-text');
      if (store.isDirty) {
        pill.className = 'status-pill status-unsaved';
        text.textContent = 'Unsaved changes';
      } else {
        pill.className = 'status-pill status-saved';
        text.textContent = 'Saved';
      }
    }

    if (event === 'saved_state') {
      const pill = this.container.querySelector('#save-status-pill');
      const text = this.container.querySelector('#save-status-text');
      pill.className = 'status-pill status-saved';
      text.textContent = 'Autosaved';
    }

    if (event === 'autosave_failed') {
      const pill = this.container.querySelector('#save-status-pill');
      const text = this.container.querySelector('#save-status-text');
      if (pill && text) {
        pill.className = 'status-pill status-backend-offline';
        text.textContent = 'Autosave off - use Save to download JSON';
      }
      ModalService.toast('Autosave off - use Save to download JSON', 'warning');
    }

    if (event === 'backend_status_change') {
      const btn = this.container.querySelector('#btn-backend-status');
      const text = this.container.querySelector('#backend-status-text');
      if (store.backendStatus === 'online') {
        btn.className = 'status-pill status-backend-online btn-secondary';
        text.textContent = 'Backend: Online';
      } else {
        btn.className = 'status-pill status-backend-offline btn-secondary';
        text.textContent = 'Backend: Offline (Demo)';
      }
    }
  }
}
