/**
 * Frontend API Service Module
 * Handles communication with the FastAPI backend (/preview, /generate, /health)
 * Includes debounce, cancellation of stale in-flight requests, and robust error handling.
 */

let activeAbortController = null;
let currentRequestId = 0;

export const ApiService = {
  baseUrl: localStorage.getItem('qp_backend_url') || 'http://127.0.0.1:8000',

  setBaseUrl(url) {
    this.baseUrl = url.trim().replace(/\/+$/, '');
    localStorage.setItem('qp_backend_url', this.baseUrl);
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
   * Requests PDF binary from backend /generate and downloads it as exam_paper.pdf
   */
  async downloadPdf(paper) {
    try {
      const res = await fetch(`${this.baseUrl}/generate`, {
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
          if (json.error) errorMsg = json.error;
        } catch {
          // ignore json parse error
        }
        return { success: false, error: errorMsg };
      }

      const blob = await res.blob();
      const filename = `${(paper.school || 'exam_paper').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)}_exam_paper.pdf`;
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();

      return { success: true };
    } catch (err) {
      return { success: false, error: `Connection failed: ${err.message}` };
    }
  }
};
