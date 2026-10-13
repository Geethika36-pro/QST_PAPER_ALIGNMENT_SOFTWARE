/**
 * Modal & Toast Notification Manager
 */

export const ModalService = {
  activeModal: null,

  showModal({ title, contentHtml, buttons = [] }) {
    this.closeModal();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = 'active-modal-backdrop';

    const windowEl = document.createElement('div');
    windowEl.className = 'modal-window';

    // Header
    const headerEl = document.createElement('div');
    headerEl.className = 'modal-header';
    headerEl.innerHTML = `
      <h3 class="modal-title">${title}</h3>
      <button class="modal-close-btn" aria-label="Close modal">&times;</button>
    `;

    // Body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'modal-body';
    if (typeof contentHtml === 'string') {
      bodyEl.innerHTML = contentHtml;
    } else if (contentHtml instanceof HTMLElement) {
      bodyEl.appendChild(contentHtml);
    }

    // Footer
    const footerEl = document.createElement('div');
    footerEl.className = 'modal-footer';

    buttons.forEach(btnConfig => {
      const btn = document.createElement('button');
      btn.className = `btn ${btnConfig.className || 'btn-secondary'}`;
      btn.textContent = btnConfig.text;
      btn.addEventListener('click', () => {
        if (btnConfig.onClick) {
          const shouldClose = btnConfig.onClick(bodyEl);
          if (shouldClose !== false) {
            this.closeModal();
          }
        } else {
          this.closeModal();
        }
      });
      footerEl.appendChild(btn);
    });

    windowEl.appendChild(headerEl);
    windowEl.appendChild(bodyEl);
    windowEl.appendChild(footerEl);
    backdrop.appendChild(windowEl);
    document.body.appendChild(backdrop);

    // Event listeners for close
    headerEl.querySelector('.modal-close-btn').addEventListener('click', () => this.closeModal());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.closeModal();
    });

    // Animate open
    requestAnimationFrame(() => backdrop.classList.add('open'));
    this.activeModal = backdrop;
    return backdrop;
  },

  closeModal() {
    if (this.activeModal) {
      this.activeModal.classList.remove('open');
      const el = this.activeModal;
      setTimeout(() => el.remove(), 200);
      this.activeModal = null;
    }
  },

  confirm({ title = 'Confirm Action', message, confirmText = 'Confirm', confirmClass = 'btn-danger', onConfirm }) {
    this.showModal({
      title,
      contentHtml: `<p style="color: var(--color-text-body); font-size: var(--font-size-sm);">${message}</p>`,
      buttons: [
        { text: 'Cancel', className: 'btn-secondary' },
        {
          text: confirmText,
          className: confirmClass,
          onClick: () => {
            if (onConfirm) onConfirm();
          }
        }
      ]
    });
  },

  toast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
      success: '✓',
      warning: '⚠',
      error: '✕',
      info: 'ℹ'
    };

    toast.innerHTML = `
      <span style="font-weight: bold;">${icons[type] || 'ℹ'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};
