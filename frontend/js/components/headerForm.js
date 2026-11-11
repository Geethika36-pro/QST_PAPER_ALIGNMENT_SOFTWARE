/**
 * Paper Header Form Component
 * Controlled inputs for School, Exam, Class, Subject, Time, Total Marks, and Page Style (Font & Size).
 */

import { store } from '../state.js';
import { ApiService, FALLBACK_OPTIONS } from '../api.js';

export class HeaderFormComponent {
  constructor(containerEl) {
    this.container = containerEl;
    this.isCollapsed = false;
    this.options = FALLBACK_OPTIONS;

    this.initOptions();
    this.render();
    this.bindEvents();
    store.subscribe((event) => this.onStateChange(event));
  }

  async initOptions() {
    this.options = await ApiService.getOptions();
    this.render();
    this.bindEvents();
  }

  render() {
    const { paper } = store;
    const summary = store.calculateMarksSummary();
    const currentFont = paper.style?.fontFamily || 'Times New Roman';
    const currentSize = paper.style?.fontSize !== undefined ? Number(paper.style.fontSize) : 11;

    const fontOptionsHtml = (this.options.fonts || FALLBACK_OPTIONS.fonts).map(f => `
      <option value="${f}" ${f === currentFont ? 'selected' : ''}>${f}</option>
    `).join('');

    const sizeOptionsHtml = (this.options.sizes || FALLBACK_OPTIONS.sizes).map(s => `
      <option value="${s}" ${s === currentSize ? 'selected' : ''}>${s} pt</option>
    `).join('');

    this.container.innerHTML = `
      <div class="editor-card header-card">
        <div class="card-header">
          <div class="card-title">
            <span>📋</span>
            <span>Examination Paper Details</span>
          </div>
          <button id="btn-toggle-header" class="header-toggle-btn" title="Toggle header details form">
            <span id="toggle-header-text">${this.isCollapsed ? 'Expand ▼' : 'Collapse ▲'}</span>
          </button>
        </div>

        <div id="header-form-body" class="card-body" style="${this.isCollapsed ? 'display: none;' : ''}">
          <div class="paper-details-grid">
            <div class="form-group field-full">
              <label class="form-label form-label-required" for="input-school">School Name</label>
              <input type="text" id="input-school" class="form-control" placeholder="e.g. ST JOHN THE BAPTIST'S ENGLISH SCHOOL" value="${paper.school || ''}" />
            </div>

            <div class="form-group field-full">
              <label class="form-label form-label-required" for="input-exam">Examination Title</label>
              <input type="text" id="input-exam" class="form-control" placeholder="e.g. FIRST TERMINAL EXAMINATION 2026-2027" value="${paper.exam || ''}" />
            </div>

            <div class="form-group">
              <label class="form-label form-label-required" for="input-class">Class</label>
              <input type="text" id="input-class" class="form-control" placeholder="e.g. VII" value="${paper.class || ''}" />
            </div>

            <div class="form-group">
              <label class="form-label form-label-required" for="input-subject">Subject</label>
              <input type="text" id="input-subject" class="form-control" placeholder="e.g. SOCIAL SCIENCE" value="${paper.subject || ''}" />
            </div>

            <div class="form-group">
              <label class="form-label" for="input-time">Duration</label>
              <input type="text" id="input-time" class="form-control" placeholder="e.g. 3hrs or 2.5 hrs" value="${paper.time || ''}" />
            </div>

            <div class="form-group">
              <label class="form-label form-label-required" for="input-total-marks">Total Marks</label>
              <input type="number" id="input-total-marks" class="form-control" placeholder="80" value="${paper.totalMarks ?? 80}" min="1" max="500" />
            </div>

            <!-- Page Style Controls -->
            <div class="form-group">
              <label class="form-label" for="select-paper-font">Font Family</label>
              <select id="select-paper-font" class="form-control">
                ${fontOptionsHtml}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="select-paper-size">Font Size (Base)</label>
              <select id="select-paper-size" class="form-control">
                ${sizeOptionsHtml}
              </select>
            </div>
          </div>
        </div>

        <!-- Marks Summary Bar -->
        <div class="paper-summary-bar">
          <div>
            <span>Configured: <strong>${paper.totalMarks || 0} Marks</strong></span>
            <span style="margin: 0 8px; color: var(--color-border-medium);">|</span>
            <span>Sections Total: <strong>${summary.calculatedTotal} Marks</strong></span>
          </div>
          <div>
            ${
              summary.isMatch
                ? `<span class="marks-stat-badge marks-match">✓ Marks match exactly (${summary.calculatedTotal}/${paper.totalMarks})</span>`
                : `<span class="marks-stat-badge marks-mismatch">⚠ Difference: ${summary.difference > 0 ? '+' : ''}${summary.difference} marks</span>`
            }
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const btnToggle = this.container.querySelector('#btn-toggle-header');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        this.isCollapsed = !this.isCollapsed;
        const body = this.container.querySelector('#header-form-body');
        const text = this.container.querySelector('#toggle-header-text');
        if (this.isCollapsed) {
          body.style.display = 'none';
          text.textContent = 'Expand ▼';
        } else {
          body.style.display = 'block';
          text.textContent = 'Collapse ▲';
        }
      });
    }

    const bindInput = (id, field, isNumber = false) => {
      const el = this.container.querySelector(id);
      if (el) {
        el.addEventListener('input', (e) => {
          const val = isNumber ? (Number(e.target.value) || 0) : e.target.value;
          store.updateHeaderField(field, val);
        });
      }
    };

    bindInput('#input-school', 'school');
    bindInput('#input-exam', 'exam');
    bindInput('#input-class', 'class');
    bindInput('#input-subject', 'subject');
    bindInput('#input-time', 'time');
    bindInput('#input-total-marks', 'totalMarks', true);

    const fontSelect = this.container.querySelector('#select-paper-font');
    if (fontSelect) {
      fontSelect.addEventListener('change', (e) => {
        store.updateStyle('fontFamily', e.target.value);
      });
    }

    const sizeSelect = this.container.querySelector('#select-paper-size');
    if (sizeSelect) {
      sizeSelect.addEventListener('change', (e) => {
        store.updateStyle('fontSize', Number(e.target.value));
      });
    }
  }

  onStateChange(event) {
    if (
      event === 'paper_loaded' ||
      event === 'section_added' ||
      event === 'section_deleted' ||
      event === 'section_updated' ||
      event === 'question_added' ||
      event === 'question_deleted' ||
      event === 'header_change' ||
      event === 'style_change'
    ) {
      const activeEl = document.activeElement;
      const activeId = activeEl ? activeEl.id : null;
      const cursorStart = activeEl ? activeEl.selectionStart : null;
      const cursorEnd = activeEl ? activeEl.selectionEnd : null;

      this.render();
      this.bindEvents();

      // Restore focus & cursor position if teacher was actively typing
      if (activeId) {
        const restoredEl = this.container.querySelector(`#${activeId}`);
        if (restoredEl && restoredEl.focus) {
          restoredEl.focus();
          if (cursorStart !== null && cursorEnd !== null && restoredEl.setSelectionRange) {
            try {
              restoredEl.setSelectionRange(cursorStart, cursorEnd);
            } catch {
              // ignore
            }
          }
        }
      }
    }
  }
}
