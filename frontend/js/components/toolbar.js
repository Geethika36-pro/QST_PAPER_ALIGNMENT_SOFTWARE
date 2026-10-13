/**
 * Top Toolbar Component
 * Controls: Open, Save, Load Sample, Download PDF, Backend Status, Save Status
 */

import { store } from '../state.js';
import { ApiService } from '../api.js';
import { FileIOService } from '../utils/fileIO.js';
import { ModalService } from './modal.js';

export class ToolbarComponent {
  constructor(containerEl) {
    this.container = containerEl;
    this.render();
    this.bindEvents();
    store.subscribe((event) => this.onStateChange(event));
  }

  render() {
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

        <!-- File & Action Buttons -->
        <input type="file" id="file-input-open" accept=".json,application/json" style="display: none;" />
        
        <button id="btn-open-file" class="btn btn-secondary" title="Open an existing question paper JSON file">
          <span>📂</span>
          <span>Open</span>
        </button>

        <button id="btn-save-file" class="btn btn-secondary" title="Export current paper as JSON file">
          <span>💾</span>
          <span>Save</span>
        </button>

        <button id="btn-load-sample" class="btn btn-secondary" title="Load Class VII Social Science sample paper">
          <span>📄</span>
          <span>Load Sample</span>
        </button>

        <button id="btn-download-pdf" class="btn btn-primary" title="Generate and download PDF via backend">
          <span id="pdf-icon">⬇</span>
          <span id="pdf-btn-text">Download PDF</span>
        </button>

        <button id="btn-print-preview" class="btn btn-secondary" title="Print or Save as PDF using browser dialog">
          <span>🖨️</span>
          <span>Print</span>
        </button>
      </div>
    `;
  }

  bindEvents() {
    const fileInput = this.container.querySelector('#file-input-open');
    const btnOpen = this.container.querySelector('#btn-open-file');
    const btnSave = this.container.querySelector('#btn-save-file');
    const btnSample = this.container.querySelector('#btn-load-sample');
    const btnPdf = this.container.querySelector('#btn-download-pdf');
    const btnPrint = this.container.querySelector('#btn-print-preview');
    const btnBackend = this.container.querySelector('#btn-backend-status');

    // Open file
    btnOpen.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const result = await FileIOService.importPaperFromFile(file);
      fileInput.value = ''; // Reset input

      if (result.success) {
        store.loadPaper(result.paper);
        ModalService.toast('Question paper imported successfully!', 'success');
      } else {
        const errorMsg = result.validationErrors
          ? result.validationErrors.join('<br>')
          : result.error;
        ModalService.showModal({
          title: 'Error Importing File',
          contentHtml: `<div style="color: var(--color-danger-text); font-size: var(--font-size-sm); line-height: 1.6;">${errorMsg}</div>`,
          buttons: [{ text: 'Close', className: 'btn-secondary' }]
        });
      }
    });

    // Save file
    btnSave.addEventListener('click', () => {
      const res = FileIOService.exportPaper(store.paper);
      if (res.success) {
        ModalService.toast(`Exported ${res.filename}`, 'success');
      } else {
        ModalService.toast(`Export failed: ${res.error}`, 'error');
      }
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

    // Download PDF
    btnPdf.addEventListener('click', async () => {
      const btnText = this.container.querySelector('#pdf-btn-text');
      const icon = this.container.querySelector('#pdf-icon');
      
      btnPdf.disabled = true;
      btnText.textContent = 'Generating PDF...';
      icon.textContent = '⏳';

      const res = await ApiService.downloadPdf(store.paper);

      btnPdf.disabled = false;
      btnText.textContent = 'Download PDF';
      icon.textContent = '⬇';

      if (res.success) {
        ModalService.toast(`PDF downloaded to your Downloads folder: ${res.filename || 'exam_paper.pdf'}`, 'success');
      } else {
        ModalService.showModal({
          title: 'PDF Generation Error',
          contentHtml: `
            <div style="font-size: var(--font-size-sm); color: var(--color-text-body); display: flex; flex-direction: column; gap: 12px;">
              <p>The backend was unable to generate the PDF.</p>
              <div style="background: var(--color-danger-bg); border: 1px solid var(--color-danger-border); color: var(--color-danger-text); padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; word-break: break-word;">
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
      } catch (err) {
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
            The software connects to the FastAPI backend for authoritative HTML paper preview and PDF rendering.
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

  onStateChange(event) {
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
