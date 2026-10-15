/**
 * Live Preview Pane Component
 * Sandboxed iframe displaying HTML from backend /preview (or client fallback)
 * Debounced ~400ms with stale-request prevention, HTTP 422 validation panel, and zoom controls.
 */

import { store } from '../state.js';
import { ApiService } from '../api.js';
import { renderClientHtml } from '../clientRenderer.js';
import { ModalService } from './modal.js';

export class PreviewPaneComponent {
  constructor(containerEl) {
    this.container = containerEl;
    this.debounceTimer = null;
    this.zoom = 1.0;
    this.render();
    this.bindEvents();
    store.subscribe((event) => this.onStateChange(event));

    // Initial preview generation
    this.schedulePreviewUpdate(0);
  }

  render() {
    this.container.innerHTML = `
      <!-- Preview Header Controls Bar -->
      <div class="preview-toolbar">
        <div class="preview-title-group">
          <span class="preview-title">Live Examination Paper Preview</span>
          <span id="preview-source-badge" class="preview-source-badge source-client" title="Rendering pipeline source">
            Client Preview
          </span>
        </div>

        <div class="preview-controls">
          <button id="btn-zoom-out" class="btn btn-secondary btn-sm" title="Zoom Out">－</button>
          <span id="zoom-level-text" class="zoom-level-label">100%</span>
          <button id="btn-zoom-in" class="btn btn-secondary btn-sm" title="Zoom In">＋</button>

          <div class="toolbar-divider" style="margin: 0 4px;"></div>

          <button id="btn-refresh-preview" class="btn btn-secondary btn-sm" title="Force Refresh Preview">
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- Error / Validation Banner Container -->
      <div id="preview-banner-container"></div>

      <!-- Main Preview Viewport -->
      <div class="preview-viewport">
        <div class="paper-sheet-wrapper" id="paper-sheet">
          <div id="preview-loader" class="preview-loading-overlay">
            <div class="spinner"></div>
            <div class="loading-text">Generating examination paper preview...</div>
          </div>
          <iframe id="paper-iframe" class="preview-iframe" sandbox="allow-same-origin allow-scripts allow-modals"></iframe>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Zoom Controls
    this.container.querySelector('#btn-zoom-in').addEventListener('click', () => this.updateZoom(this.zoom + 0.1));
    this.container.querySelector('#btn-zoom-out').addEventListener('click', () => this.updateZoom(this.zoom - 0.1));

    // Force Refresh
    this.container.querySelector('#btn-refresh-preview').addEventListener('click', () => {
      this.triggerPreviewUpdate(true);
    });
  }

  updateZoom(newZoom) {
    const zoomText = this.container.querySelector('#zoom-level-text');
    const paperSheet = this.container.querySelector('#paper-sheet');
    this.zoom = Math.min(1.5, Math.max(0.6, Math.round(newZoom * 10) / 10));
    if (zoomText) zoomText.textContent = `${Math.round(this.zoom * 100)}%`;
    if (paperSheet) paperSheet.style.transform = `scale(${this.zoom})`;
  }

  schedulePreviewUpdate(delayMs = 400) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.triggerPreviewUpdate();
    }, delayMs);
  }

  async triggerPreviewUpdate(isManual = false) {
    const loader = this.container.querySelector('#preview-loader');
    const iframe = this.container.querySelector('#paper-iframe');
    const bannerContainer = this.container.querySelector('#preview-banner-container');
    const sourceBadge = this.container.querySelector('#preview-source-badge');

    if (loader) loader.classList.add('active');

    // Attempt backend preview first
    const result = await ApiService.requestPreviewHtml(store.paper);

    if (loader) loader.classList.remove('active');

    // Disregard if request was canceled/stale
    if (result.isStale) {
      return;
    }

    if (result.success) {
      // Backend returned valid HTML!
      bannerContainer.innerHTML = '';
      sourceBadge.className = 'preview-source-badge source-backend';
      sourceBadge.textContent = 'Backend Rendered';
      sourceBadge.title = 'Authoritative FastAPI backend preview';

      store.backendStatus = 'online';
      store.previewSource = 'backend';
      store.notify('backend_status_change');

      this.injectHtmlToIframe(iframe, result.html);
      if (isManual) ModalService.toast('Preview updated from backend', 'success');
      return;
    }

    // Handle HTTP 422 or 400 Validation Error from backend
    if (result.status === 422 || result.status === 400) {
      sourceBadge.className = 'preview-source-badge source-client';
      sourceBadge.textContent = 'Backend Error 422';

      bannerContainer.innerHTML = `
        <div class="preview-alert-banner preview-alert-error">
          <span class="preview-alert-icon">⚠️</span>
          <div class="preview-alert-content">
            <div class="preview-alert-title">Backend Validation Error (HTTP 422)</div>
            <p>The backend rejected the question paper payload:</p>
            <div class="preview-alert-details">${result.details || 'Schema validation failed'}</div>
          </div>
        </div>
      `;
      // In 422 case, show fallback client HTML so user doesn't see a blank page
      const clientHtml = renderClientHtml(store.paper);
      this.injectHtmlToIframe(iframe, clientHtml);
      return;
    }

    // Backend is offline or network error: Graceful Demo Mode / Fallback
    store.backendStatus = 'offline';
    store.previewSource = 'client';
    store.notify('backend_status_change');

    sourceBadge.className = 'preview-source-badge source-client';
    sourceBadge.textContent = 'Demo Mode (Client)';
    sourceBadge.title = 'Backend is offline; showing faithful client-side preview';

    bannerContainer.innerHTML = `
      <div class="preview-alert-banner preview-alert-warning">
        <span class="preview-alert-icon">ℹ️</span>
        <div class="preview-alert-content">
          <div class="preview-alert-title">Backend Offline — Showing Live Client Preview</div>
          <p>
            The backend server is offline or unreachable at <code>${ApiService.getBaseUrl()}</code>.
            The editor is functioning normally in <strong>Demo Mode</strong> with real-time preview.
          </p>
        </div>
      </div>
    `;

    const fallbackHtml = renderClientHtml(store.paper);
    this.injectHtmlToIframe(iframe, fallbackHtml);
    if (isManual) ModalService.toast('Preview refreshed', 'info');
  }

  injectHtmlToIframe(iframe, html) {
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
    } catch {
      iframe.srcdoc = html;
    }
  }

  onStateChange(event) {
    if (event === 'reset_zoom') {
      this.updateZoom(1.0);
    }

    if (
      event === 'header_change' ||
      event === 'section_added' ||
      event === 'section_deleted' ||
      event === 'section_updated' ||
      event === 'question_added' ||
      event === 'question_updated' ||
      event === 'question_deleted' ||
      event === 'question_reordered'
    ) {
      this.schedulePreviewUpdate(400);
    }

    if (event === 'paper_loaded') {
      this.updateZoom(1.0);
      this.triggerPreviewUpdate();
    }
  }
}
