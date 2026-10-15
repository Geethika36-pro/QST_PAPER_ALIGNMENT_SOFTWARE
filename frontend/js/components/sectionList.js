/**
 * Section & Question Management Component
 * Controls section tabs, section settings, question list, and reordering.
 */

import { store } from '../state.js';
import { ModalService } from './modal.js';

export class SectionListComponent {
  constructor(containerEl) {
    this.container = containerEl;
    this.render();
    this.bindEvents();
    store.subscribe((event) => this.onStateChange(event));
  }

  // Calculate cumulative question index across sections
  getQuestionGlobalNumber(sectionIdx, questionIdx) {
    let num = 0;
    for (let s = 0; s < sectionIdx; s++) {
      num += (store.paper.sections[s]?.questions?.length || 0);
    }
    return num + questionIdx + 1;
  }

  render() {
    const { paper, activeSectionIndex } = store;
    const sections = paper.sections || [];
    const activeSection = sections[activeSectionIndex] || null;

    // Tabs HTML
    const tabsHtml = sections.map((sec, idx) => {
      const isActive = idx === activeSectionIndex;
      const count = (sec.questions || []).length;
      return `
        <button class="section-tab-item ${isActive ? 'active' : ''}" data-index="${idx}">
          <span>Section ${sec.label || idx + 1}</span>
          <span class="section-tab-badge">${count} q</span>
        </button>
      `;
    }).join('');

    // Active Section Details & Questions
    let activeContentHtml = '';

    if (activeSection) {
      const qCount = (activeSection.questions || []).length;
      const marksPerQ = activeSection.marksPerQuestion ?? 1;
      const sectionTotal = marksPerQ * qCount;

      // Question Cards HTML
      let questionsHtml = '';
      if (qCount === 0) {
        questionsHtml = `
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <div class="empty-state-title">No questions in Section ${activeSection.label} yet</div>
            <div class="empty-state-desc">Click "Add Question" below to add your first question to this section.</div>
          </div>
        `;
      } else {
        questionsHtml = activeSection.questions.map((q, qIdx) => {
          const globalNum = this.getQuestionGlobalNumber(activeSectionIndex, qIdx);
          const qtype = q.type || 'mcq';
          const typeNames = {
            mcq: 'MCQ',
            sequence: 'Sequence',
            assertion_reason: 'Assertion–Reason',
            match: 'Match Following',
            short: 'Short Answer',
            long: 'Long Answer',
            passage: 'Passage Based',
            map: 'Map Based'
          };

          // Build snippet
          let snippet = q.text || '';
          if (qtype === 'assertion_reason') {
            snippet = `(A) ${q.assertion || ''} — (R) ${q.reason || ''}`;
          } else if (qtype === 'passage') {
            snippet = q.passage || 'Read passage...';
          }

          const isFirst = qIdx === 0;
          const isLast = qIdx === qCount - 1;

          return `
            <div class="question-card" data-qindex="${qIdx}">
              <div class="question-card-top">
                <div class="question-header-info">
                  <span class="question-number-badge">#${globalNum}</span>
                  <span class="qtype-badge qtype-${qtype}">${typeNames[qtype] || qtype}</span>
                  ${q.figure && q.figure.src ? '<span class="qtype-badge figure-badge" title="Question includes a figure">🖼️ Figure</span>' : ''}
                </div>
                <div class="question-actions">
                  <button class="btn btn-secondary btn-sm btn-icon btn-move-up" data-qindex="${qIdx}" ${isFirst ? 'disabled' : ''} title="Move Question Up">
                    ▲
                  </button>
                  <button class="btn btn-secondary btn-sm btn-icon btn-move-down" data-qindex="${qIdx}" ${isLast ? 'disabled' : ''} title="Move Question Down">
                    ▼
                  </button>
                  <button class="btn btn-secondary btn-sm btn-edit-question" data-qindex="${qIdx}" title="Edit question">
                    ✏️ Edit
                  </button>
                  <button class="btn btn-danger btn-sm btn-delete-question" data-qindex="${qIdx}" title="Delete question">
                    🗑️
                  </button>
                </div>
              </div>
              <div class="question-body-snippet">${snippet || '<em style="color: var(--color-text-dim);">No text entered</em>'}</div>
              <div class="question-preview-meta">
                ${this.renderQuestionMetaSnippet(q)}
              </div>
            </div>
          `;
        }).join('');
      }

      activeContentHtml = `
        <!-- Section Meta Form -->
        <div class="section-meta-strip">
          <div class="form-group">
            <label class="form-label">Label</label>
            <input type="text" id="input-section-label" class="form-control form-control-sm" value="${activeSection.label || ''}" placeholder="A" />
          </div>

          <div class="form-group">
            <label class="form-label">Marks / Qstn</label>
            <input type="number" id="input-section-marks" class="form-control form-control-sm" value="${marksPerQ}" min="1" max="50" />
          </div>

          <div class="form-group field-instruction">
            <label class="form-label">Section Instructions (Optional)</label>
            <input type="text" id="input-section-instruction" class="form-control form-control-sm" value="${activeSection.instruction || ''}" placeholder="e.g. Choose the correct answer from the brackets" />
          </div>

          <div style="display: flex; gap: 8px;">
            <button id="btn-delete-section" class="btn btn-danger btn-sm" title="Delete current section">
              🗑️ Delete Section
            </button>
          </div>
        </div>

        <!-- Section Marks Calculation Strip -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 13px; color: var(--color-text-muted);">
          <span><strong>${qCount} questions</strong> in Section ${activeSection.label}</span>
          <span>Formula: <strong>${marksPerQ} × ${qCount} = ${sectionTotal} Marks</strong></span>
        </div>

        <!-- Questions List -->
        <div class="questions-list">
          ${questionsHtml}
        </div>

        <!-- Add Question Bar -->
        <div style="display: flex; gap: 8px; justify-content: flex-start; align-items: center; padding-top: 8px;">
          <button id="btn-add-question" class="btn btn-primary" title="Add question to this section">
            ➕ Add Question
          </button>
        </div>
      `;
    } else {
      activeContentHtml = `
        <div class="empty-state">
          <div class="empty-state-icon">📂</div>
          <div class="empty-state-title">No sections created</div>
          <div class="empty-state-desc">Click "Add Section" to create Section A.</div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="editor-card section-card">
        <div class="card-header">
          <div class="card-title">
            <span>📑</span>
            <span>Sections &amp; Questions</span>
          </div>
          <button id="btn-add-section" class="btn btn-secondary btn-sm" title="Add a new section">
            ➕ Add Section
          </button>
        </div>

        <div class="card-body">
          <!-- Section Tabs Navigation -->
          <div class="sections-nav">
            ${tabsHtml}
          </div>

          <!-- Active Section Content Area -->
          <div id="active-section-wrapper">
            ${activeContentHtml}
          </div>
        </div>
      </div>
    `;
  }

  renderQuestionMetaSnippet(q) {
    if (q.type === 'mcq') {
      const opts = (q.options || []).filter(o => o?.trim());
      return `<span>${opts.length} Options (A, B, C, D)</span>`;
    }
    if (q.type === 'sequence') {
      const items = (q.items || []).filter(i => i?.trim());
      return `<span>${items.length} Sequence Events</span>`;
    }
    if (q.type === 'assertion_reason') {
      return `<span>Assertion &amp; Reason format</span>`;
    }
    if (q.type === 'match') {
      const colA = (q.columnA || []).filter(a => a?.trim());
      return `<span>${colA.length} Match Pairs</span>`;
    }
    if (q.type === 'passage') {
      const sub = (q.subQuestions || []).length;
      return `<span>${sub} Sub-questions</span>`;
    }
    if (q.type === 'map') {
      const places = (q.places || []).filter(p => p?.trim());
      return `<span>${places.length} Places to locate</span>`;
    }
    return '';
  }

  bindEvents() {
    // Section Tab Switching
    this.container.querySelectorAll('.section-tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        const idx = Number(tab.dataset.index);
        store.setActiveSection(idx);
      });
    });

    // Add Section
    const btnAddSec = this.container.querySelector('#btn-add-section');
    if (btnAddSec) {
      btnAddSec.addEventListener('click', () => {
        store.addSection();
        ModalService.toast('New section created!', 'success');
      });
    }

    // Section Meta Inputs
    const secLabel = this.container.querySelector('#input-section-label');
    const secMarks = this.container.querySelector('#input-section-marks');
    const secInstruction = this.container.querySelector('#input-section-instruction');

    if (secLabel) {
      secLabel.addEventListener('input', (e) => {
        store.updateSection(store.activeSectionIndex, { label: e.target.value.trim().toUpperCase() });
      });
    }
    if (secMarks) {
      secMarks.addEventListener('input', (e) => {
        store.updateSection(store.activeSectionIndex, { marksPerQuestion: Number(e.target.value) || 1 });
      });
    }
    if (secInstruction) {
      secInstruction.addEventListener('input', (e) => {
        store.updateSection(store.activeSectionIndex, { instruction: e.target.value });
      });
    }

    // Delete Section
    const btnDelSec = this.container.querySelector('#btn-delete-section');
    if (btnDelSec) {
      btnDelSec.addEventListener('click', () => {
        const sec = store.paper.sections[store.activeSectionIndex];
        const label = sec?.label || 'this';
        ModalService.confirm({
          title: `Delete Section ${label}?`,
          message: `Are you sure you want to delete Section ${label} and all its questions? This action cannot be undone.`,
          confirmText: 'Delete Section',
          confirmClass: 'btn-danger',
          onConfirm: () => {
            store.deleteSection(store.activeSectionIndex);
            ModalService.toast(`Section ${label} deleted.`, 'info');
          }
        });
      });
    }

    // Add Question
    const btnAddQ = this.container.querySelector('#btn-add-question');
    if (btnAddQ) {
      btnAddQ.addEventListener('click', () => {
        store.openQuestionEditor(store.activeSectionIndex, null, 'mcq');
      });
    }

    // Question Actions (Edit, Delete, Move Up, Move Down)
    this.container.querySelectorAll('.btn-edit-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const qIdx = Number(btn.dataset.qindex);
        store.openQuestionEditor(store.activeSectionIndex, qIdx);
      });
    });

    this.container.querySelectorAll('.btn-delete-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const qIdx = Number(btn.dataset.qindex);
        const globalNum = this.getQuestionGlobalNumber(store.activeSectionIndex, qIdx);
        ModalService.confirm({
          title: `Delete Question #${globalNum}?`,
          message: `Are you sure you want to remove Question #${globalNum}?`,
          confirmText: 'Delete Question',
          confirmClass: 'btn-danger',
          onConfirm: () => {
            store.deleteQuestion(store.activeSectionIndex, qIdx);
            ModalService.toast(`Question #${globalNum} deleted.`, 'info');
          }
        });
      });
    });

    this.container.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const qIdx = Number(btn.dataset.qindex);
        store.moveQuestion(store.activeSectionIndex, qIdx, -1);
      });
    });

    this.container.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const qIdx = Number(btn.dataset.qindex);
        store.moveQuestion(store.activeSectionIndex, qIdx, 1);
      });
    });
  }

  onStateChange(event) {
    if (
      event === 'paper_loaded' ||
      event === 'section_added' ||
      event === 'section_deleted' ||
      event === 'section_updated' ||
      event === 'active_section_change' ||
      event === 'question_added' ||
      event === 'question_updated' ||
      event === 'question_deleted' ||
      event === 'question_reordered'
    ) {
      this.render();
      this.bindEvents();
    }
  }
}
