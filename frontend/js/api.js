/**
 * Frontend API Service Module
 * Handles communication with the FastAPI backend (/preview, /generate, /health, /options)
 * Includes debounce, cancellation of stale in-flight requests, and robust error handling.
 */

let activeAbortController = null;
let currentRequestId = 0;
let cachedOptions = null;

export const FALLBACK_OPTIONS = {
  fonts: ['Times New Roman', 'Arial', 'Calibri', 'Cambria', 'Georgia', 'Verdana', 'Courier New'],
  sizes: [9, 10, 10.5, 11, 12, 13, 14],
  formats: ['pdf', 'docx'],
  figure: {
    maxBytes: 1572864,
    maxCount: 12,
    widths: [25, 40, 50, 65, 80, 100]
  }
};

export const ApiService = {
  baseUrl: (() => {
    const saved = localStorage.getItem('qp_backend_url');
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
    if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
      return window.location.origin;
    }
    return 'http://127.0.0.1:8000';
  })(),

  setBaseUrl(url) {
    this.baseUrl = url.trim().replace(/\/+$/, '');
    localStorage.setItem('qp_backend_url', this.baseUrl);
    cachedOptions = null;
  },

  getBaseUrl() {
    return this.baseUrl;
  },

  /**
   * Checks if the backend is reachable
   */
  async checkHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return { isOnline: data.status === 'ok' };
      }
      return { isOnline: false, error: `HTTP ${res.status}` };
    } catch (err) {
      return { isOnline: false, error: err.message };
    }
  },

  /**
   * Fetches configurable options (fonts, sizes, formats, figure limits) from backend /options
   * Falls back to built-in constants if offline.
   */
  async getOptions() {
    if (cachedOptions) return cachedOptions;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${this.baseUrl}/options`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        cachedOptions = await res.json();
        return cachedOptions;
      }
    } catch {
      // Fallback to built-in constants
    }
    return FALLBACK_OPTIONS;
  },

  /**
   * Requests HTML preview from backend /preview endpoint
   * Cancels any prior pending request to avoid stale overwrites.
   */
  async requestPreviewHtml(paper) {
    const requestId = ++currentRequestId;

    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();

    try {
      const res = await fetch(`${this.baseUrl}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/html, application/json'
        },
        body: JSON.stringify(paper),
        signal: activeAbortController.signal
      });

      // Ignore if a newer request was dispatched in the meantime
      if (requestId !== currentRequestId) {
        return { isStale: true };
      }

      if (res.ok) {
        const html = await res.text();
        return { success: true, html, source: 'backend' };
      }

      // Handle 422 Unprocessable Entity
      if (res.status === 422) {
        let errorDetails = '';
        try {
          const json = await res.json();
          if (Array.isArray(json.detail)) {
            errorDetails = json.detail.map(d => `${d.loc ? d.loc.join('.') : ''}: ${d.msg}`).join('\n');
          } else {
            errorDetails = JSON.stringify(json.detail, null, 2);
          }
        } catch {
          errorDetails = await res.text();
        }
        return {
          success: false,
          status: 422,
          error: 'Validation Error (HTTP 422)',
          details: errorDetails
        };
      }

      const errorText = await res.text();
      return {
        success: false,
        status: res.status,
        error: `Backend error (HTTP ${res.status})`,
        details: errorText
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { isStale: true };
      }
      return {
        success: false,
        isNetworkError: true,
        error: 'Network Error: Unable to connect to backend',
        details: err.message
      };
    }
  },

  /**
   * Requests document export (PDF or DOCX) from backend /generate?format=...
   */
  async downloadPaper(paper, format = 'pdf') {
    const fmt = (format || 'pdf').toLowerCase();
    const mimeTypes = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };

    try {
      const res = await fetch(`${this.baseUrl}/generate?format=${encodeURIComponent(fmt)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paper)
      });

      if (!res.ok) {
        let errorMsg = `Server error (HTTP ${res.status})`;
        try {
          const json = await res.json();
          if (json.error) {
            errorMsg = json.error;
          } else if (json.detail) {
            errorMsg = Array.isArray(json.detail)
              ? json.detail.map(d => `${d.loc ? d.loc.join('.') : ''}: ${d.msg}`).join('\n')
              : JSON.stringify(json.detail);
          }
        } catch {
          // ignore
        }
        return { success: false, error: errorMsg };
      }

      const blob = await res.blob();
      const exportBlob = new Blob([blob], { type: mimeTypes[fmt] || 'application/octet-stream' });

      // Determine filename from Content-Disposition header or paper metadata
      let filename = `exam_paper.${fmt}`;
      const disposition = res.headers.get('Content-Disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename=["']?([^"';]+)["']?/i);
        if (match && match[1]) {
          filename = match[1].trim();
        }
      } else {
        const schoolName = (paper.school || 'exam_paper')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 30) || 'exam_paper';
        filename = `${schoolName}.${fmt}`;
      }

      const downloadUrl = window.URL.createObjectURL(exportBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
      }, 2000);

      return { success: true, filename, format: fmt };
    } catch (err) {
      return { success: false, error: `Connection failed: ${err.message}` };
    }
  },

  /**
   * Thin wrapper around downloadPaper for backwards compatibility
   */
  async downloadPdf(paper) {
    return this.downloadPaper(paper, 'pdf');
  }
};
