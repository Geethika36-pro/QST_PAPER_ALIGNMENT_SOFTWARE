/**
 * Question Editor Modal Component
 * Supports all 8 Question Types:
 * MCQ, Sequence, Assertion-Reason, Match, Short, Long, Passage, Map.
 * Includes optional Figure upload/paste/drag-drop box and Math Symbol Palette.
 */

import { store } from '../state.js';
import { validateQuestion } from '../validator.js';
import { ModalService } from './modal.js';

const MATH_SYMBOLS = [
  'x²', 'x³', '√', 'π', '°', '∠', '△', '≤', '≥', '≠', '±', '×', '÷', '½', '∴', 'θ'
];

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class QuestionFormComponent {
  constructor() {
    this.modalEl = null;
    this.currentData = null;
    this.lastFocusedInput = null;
    this.pasteListener = null;

    store.subscribe((event, state, payload) => {
      if (event === 'open_question_modal') {
        this.open(payload);
      } else if (event === 'close_question_modal') {
        this.close();
      }
    });
  }

  open({ sectionIndex, questionIndex, isNew, data }) {
    this.currentData = JSON.parse(JSON.stringify(data));
    this.sectionIndex = sectionIndex;
    this.questionIndex = questionIndex;
    this.isNew = isNew;
    this.lastFocusedInput = null;

    const section = store.paper.sections[sectionIndex];
    const secLabel = section?.label || 'A';
    const title = isNew
      ? `Add New Question — Section ${secLabel}`
      : `Edit Question — Section ${secLabel}`;

    const mathSymbolsHtml = MATH_SYMBOLS.map(sym => `
      <button type="button" class="btn-math-sym" data-sym="${sym}" title="Insert ${sym}">${sym}</button>
    `).join('');

    const contentHtml = `
      <div id="question-form-container" class="question-editor-wrapper">
        <!-- Question Type Dropdown -->
        <div class="qtype-selector-strip">
          <label class="form-label form-label-required" for="select-question-type">Question Type</label>
          <select id="select-question-type" class="form-control">
            <option value="mcq">Multiple Choice Question (MCQ)</option>
            <option value="sequence">Sequence Question (Chronological Order)</option>
            <option value="assertion_reason">Assertion–Reason Question</option>
            <option value="match">Match the Following</option>
            <option value="short">Short Answer Question</option>
            <option value="long">Long Answer Question</option>
            <option value="passage">Passage-Based Question</option>
            <option value="map">Map-Based Question</option>
          </select>
        </div>

        <!-- Math Symbols Palette -->
        <div class="math-palette-strip" title="Click any symbol to insert at cursor in the last focused input">
          <span class="math-palette-label">Math / Special Symbols:</span>
          ${mathSymbolsHtml}
        </div>

        <!-- Dynamic Form Fields Area -->
        <div id="dynamic-fields-area"></div>

        <!-- Shared Figure Upload / Editor Box -->
        <div id="figure-section-container"></div>

        <!-- Inline Validation Alert Box -->
        <div id="form-validation-alert" style="display: none; margin-top: 14px; background: var(--color-danger-bg); border: 1px solid var(--color-danger-border); color: var(--color-danger-text); padding: 8px 12px; border-radius: 6px; font-size: 13px;"></div>
      </div>
    `;

    this.modalEl = ModalService.showModal({
      title,
      contentHtml,
      buttons: [
        { text: 'Cancel', className: 'btn-secondary', onClick: () => store.closeQuestionEditor() },
        {
          text: isNew ? 'Add Question' : 'Save Changes',
          className: 'btn-primary',
          onClick: () => this.handleSave()
        }
      ]
    });

    const modalWindow = this.modalEl.querySelector('.modal-window');
    if (modalWindow) {
      modalWindow.classList.add('modal-window-lg');
    }

    const selectType = this.modalEl.querySelector('#select-question-type');
    selectType.value = this.currentData.type || 'mcq';

    selectType.addEventListener('change', (e) => {
      this.handleTypeChange(e.target.value);
    });

    // Math symbol clicks
    this.modalEl.querySelectorAll('.btn-math-sym').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const sym = btn.dataset.sym;
        this.insertSymbol(sym);
      });
    });

    // Clipboard Paste Listener (Ctrl+V)
    this.pasteListener = (e) => {
      if (!this.modalEl) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            this.processImageFile(file);
          }
          break;
        }
      }
    };
    window.addEventListener('paste', this.pasteListener);

    this.renderDynamicFields();
  }

  close() {
    if (this.pasteListener) {
      window.removeEventListener('paste', this.pasteListener);
      this.pasteListener = null;
    }
    ModalService.closeModal();
    this.modalEl = null;
    this.lastFocusedInput = null;
  }

  insertSymbol(sym) {
    let target = this.lastFocusedInput;
    if (!target || !document.contains(target)) {
      target = this.modalEl.querySelector('textarea, input[type="text"]');
    }
    if (!target) return;

    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const val = target.value;
    target.value = val.substring(0, start) + sym + val.substring(end);
    target.selectionStart = target.selectionEnd = start + sym.length;
    target.focus();
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  handleTypeChange(newType) {
    this.syncFormToData();
    const preservedText = this.collectCurrentText();
    const preservedFigure = this.currentData.figure; // CARRY FIGURE OVER!
    const template = store.getDefaultQuestionTemplate(newType);

    if (preservedText && (newType !== 'assertion_reason')) {
      template.text = preservedText;
    }
    if (preservedFigure) {
      template.figure = preservedFigure;
    }

    this.currentData = template;
    this.renderDynamicFields();
  }

  collectCurrentText() {
    if (!this.modalEl) return '';
    const textInput = this.modalEl.querySelector('#input-question-text');
    return textInput ? textInput.value : (this.currentData.text || '');
  }

  renderDynamicFields() {
    const container = this.modalEl.querySelector('#dynamic-fields-area');
    if (!container) return;

    const q = this.currentData;
    const type = q.type;
    let html = '';

    if (type === 'mcq') {
      const opts = q.options || ['', '', '', ''];
      html = `
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label form-label-required" for="input-question-text">Question Text</label>
          <textarea id="input-question-text" class="form-control" rows="2" placeholder="e.g. Which island in the Andaman and Nicobar Islands is home to the only active volcano in India?">${escapeHtml(q.text || '')}</textarea>
        </div>

        <div class="sub-box">
          <div class="sub-box-title">Multiple Choice Options</div>
          <div class="options-grid-inputs">
            <div class="option-input-item">
              <span class="option-prefix">A)</span>
              <input type="text" class="form-control form-control-sm opt-input" data-index="0" value="${escapeHtml(opts[0] || '')}" placeholder="Option A" />
            </div>
            <div class="option-input-item">
              <span class="option-prefix">B)</span>
              <input type="text" class="form-control form-control-sm opt-input" data-index="1" value="${escapeHtml(opts[1] || '')}" placeholder="Option B" />
            </div>
            <div class="option-input-item">
              <span class="option-prefix">C)</span>
              <input type="text" class="form-control form-control-sm opt-input" data-index="2" value="${escapeHtml(opts[2] || '')}" placeholder="Option C" />
            </div>
            <div class="option-input-item">
              <span class="option-prefix">D)</span>
              <input type="text" class="form-control form-control-sm opt-input" data-index="3" value="${escapeHtml(opts[3] || '')}" placeholder="Option D" />
            </div>
          </div>
        </div>
      `;
    } else if (type === 'sequence') {
      const items = q.items || ['', '', '', ''];
      const opts = q.options || ['', '', '', ''];
      const roman = ['i', 'ii', 'iii', 'iv'];

      const itemsHtml = [0, 1, 2, 3].map(i => `
        <div class="option-input-item">
          <span class="option-prefix">(${roman[i]})</span>
          <input type="text" class="form-control form-control-sm seq-item-input" data-index="${i}" value="${escapeHtml(items[i] || '')}" placeholder="Event ${roman[i]}" />
        </div>
      `).join('');

      const choicesHtml = [0, 1, 2, 3].map(i => `
        <div class="option-input-item">
          <span class="option-prefix">${'ABCD'[i]}.</span>
          <input type="text" class="form-control form-control-sm seq-opt-input" data-index="${i}" value="${escapeHtml(opts[i] || '')}" placeholder="e.g. (ii) → (iv) → (iii) → (i)" />
        </div>
      `).join('');

      html = `
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label form-label-required" for="input-question-text">Question Instruction</label>
          <input type="text" id="input-question-text" class="form-control" value="${escapeHtml(q.text || 'Arrange the following events in chronological order:')}" />
        </div>

        <div class="sub-box" style="margin-bottom: 14px;">
          <div class="sub-box-title">Four Sequence Events to Arrange</div>
          <div class="options-grid-inputs">
            ${itemsHtml}
          </div>
        </div>

        <div class="sub-box">
          <div class="sub-box-title">Four Answer Order Choices</div>
          <div class="options-grid-inputs">
            ${choicesHtml}
          </div>
        </div>
      `;
    } else if (type === 'assertion_reason') {
      const opts = q.options || store.getDefaultQuestionTemplate('assertion_reason').options;
      const choicesHtml = [0, 1, 2, 3].map(i => `
        <div class="option-input-item" style="grid-column: 1 / -1;">
          <span class="option-prefix">${'ABCD'[i]})</span>
          <input type="text" class="form-control form-control-sm ar-opt-input" data-index="${i}" value="${escapeHtml(opts[i] || '')}" />
        </div>
      `).join('');

      html = `
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label form-label-required" for="input-assertion">Assertion (A)</label>
          <textarea id="input-assertion" class="form-control" rows="2" placeholder="e.g. The introduction of coins was a major step forward from the barter system.">${escapeHtml(q.assertion || '')}</textarea>
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label form-label-required" for="input-reason">Reason (R)</label>
          <textarea id="input-reason" class="form-control" rows="2" placeholder="e.g. Coins made it easier to buy, sell, and store value compared to exchanging goods directly.">${escapeHtml(q.reason || '')}</textarea>
        </div>

        <div class="sub-box">
          <div class="sub-box-title">Standard Answer Choices (Prefilled &amp; Editable)</div>
          <div class="options-grid-inputs">
            ${choicesHtml}
          </div>
        </div>
      `;
    } else if (type === 'match') {
      const colA = q.columnA || ['', '', '', ''];
      const colB = q.columnB || ['', '', '', ''];
      const opts = q.options || ['', '', '', ''];
      const abcd = 'abcdefgh';

      const colAHtml = [0, 1, 2, 3].map(i => `
        <div class="option-input-item">
          <span class="option-prefix">${i + 1}.</span>
          <input type="text" class="form-control form-control-sm match-col-a-input" data-index="${i}" value="${escapeHtml(colA[i] || '')}" placeholder="Entry ${i + 1}" />
        </div>
      `).join('');

      const colBHtml = [0, 1, 2, 3].map(i => `
        <div class="option-input-item">
          <span class="option-prefix">(${abcd[i]})</span>
          <input type="text" class="form-control form-control-sm match-col-b-input" data-index="${i}" value="${escapeHtml(colB[i] || '')}" placeholder="Match (${abcd[i]})" />
        </div>
      `).join('');

      const choicesHtml = [0, 1, 2, 3].map(i => `
        <div class="option-input-item">
          <span class="option-prefix">${'ABCD'[i]}.</span>
          <input type="text" class="form-control form-control-sm match-opt-input" data-index="${i}" value="${escapeHtml(opts[i] || '')}" placeholder="e.g. (1-c) (2-d) (3-b) (4-a)" />
        </div>
      `).join('');

      html = `
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label form-label-required" for="input-question-text">Instruction</label>
          <input type="text" id="input-question-text" class="form-control" value="${escapeHtml(q.text || 'Match the following')}" />
        </div>

        <div class="match-columns-grid" style="margin-bottom: 14px;">
          <div class="sub-box">
            <div class="sub-box-title">Column A Entries</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${colAHtml}
            </div>
          </div>
          <div class="sub-box">
            <div class="sub-box-title">Column B Entries</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${colBHtml}
            </div>
          </div>
        </div>

        <div class="sub-box">
          <div class="sub-box-title">Four Answer Choices</div>
          <div class="options-grid-inputs">
            ${choicesHtml}
          </div>
        </div>
      `;
    } else if (type === 'short' || type === 'long') {
      const isLong = type === 'long';
      html = `
        <div class="form-group">
          <label class="form-label form-label-required" for="input-question-text">${isLong ? 'Long Answer' : 'Short Answer'} Question Text</label>
          <textarea id="input-question-text" class="form-control" rows="${isLong ? 4 : 2}" placeholder="Enter examination question text here...">${escapeHtml(q.text || '')}</textarea>
        </div>
      `;
    } else if (type === 'passage') {
      const subQuestions = q.subQuestions || [{ text: '', marks: 2 }];
      const subHtml = subQuestions.map((sq, idx) => `
        <div class="dynamic-row" data-index="${idx}">
          <span class="dynamic-row-num">${idx + 1}.</span>
          <input type="text" class="form-control sq-text-input" value="${escapeHtml(sq.text || '')}" placeholder="Sub-question ${idx + 1}" />
          <div class="marks-input-wrapper">
            <input type="number" class="form-control form-control-sm sq-marks-input" value="${sq.marks ?? 2}" min="1" max="20" title="Marks" />
          </div>
          <button type="button" class="btn btn-danger btn-sm btn-remove-sq" data-index="${idx}" title="Remove sub-question">✕</button>
        </div>
      `).join('');

      html = `
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label form-label-required" for="input-passage-text">Passage Text</label>
          <textarea id="input-passage-text" class="form-control" rows="4" placeholder="Read the following paragraph and answer the questions given below...">${escapeHtml(q.passage || '')}</textarea>
        </div>

        <div class="sub-box">
          <div class="sub-box-title">
            <span>Passage Sub-Questions</span>
            <button type="button" id="btn-add-subquestion" class="btn btn-secondary btn-sm">➕ Add Sub-Question</button>
          </div>
          <div class="dynamic-list" id="subquestions-list">
            ${subHtml}
          </div>
        </div>
      `;
    } else if (type === 'map') {
      const places = q.places || [''];
      const placesHtml = places.map((p, idx) => `
        <div class="dynamic-row" data-index="${idx}">
          <span class="dynamic-row-num">${idx + 1}.</span>
          <input type="text" class="form-control map-place-input" value="${escapeHtml(p || '')}" placeholder="Place ${idx + 1} to locate" />
          <button type="button" class="btn btn-danger btn-sm btn-remove-place" data-index="${idx}" title="Remove place">✕</button>
        </div>
      `).join('');

      html = `
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label form-label-required" for="input-question-text">Map Question Text</label>
          <input type="text" id="input-question-text" class="form-control" value="${escapeHtml(q.text || 'Locate the following places in an Outline map of India')}" />
        </div>

        <div class="sub-box">
          <div class="sub-box-title">
            <span>Places to Locate</span>
            <button type="button" id="btn-add-place" class="btn btn-secondary btn-sm">➕ Add Place</button>
          </div>
          <div class="dynamic-list" id="places-list">
            ${placesHtml}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
    this.renderFigureBox();
    this.bindDynamicEvents();
  }

  renderFigureBox() {
    const figContainer = this.modalEl.querySelector('#figure-section-container');
    if (!figContainer) return;

    const fig = this.currentData.figure;
    if (fig && fig.src) {
      const widths = [25, 40, 50, 65, 80, 100];
      const widthOptions = widths.map(w => `
        <option value="${w}" ${Number(fig.widthPct || 50) === w ? 'selected' : ''}>${w}%</option>
      `).join('');

      figContainer.innerHTML = `
        <div class="figure-editor-box">
          <div class="figure-editor-header">
            <div class="figure-editor-title">
              <span>🖼️</span>
              <span>Question Figure (Image)</span>
            </div>
            <button type="button" id="btn-remove-figure" class="btn btn-danger btn-sm" title="Remove figure from question">
              🗑️ Remove Figure
            </button>
          </div>

          <div class="figure-preview-layout">
            <div class="figure-thumbnail-wrapper">
              <img src="${fig.src}" alt="Question Figure Preview" class="figure-thumbnail" />
            </div>

            <div class="figure-controls-grid">
              <div class="form-group">
                <label class="form-label" for="select-fig-width">Width (% of content)</label>
                <select id="select-fig-width" class="form-control form-control-sm">
                  ${widthOptions}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="select-fig-align">Alignment</label>
                <select id="select-fig-align" class="form-control form-control-sm">
                  <option value="center" ${fig.align === 'center' || !fig.align ? 'selected' : ''}>Center</option>
                  <option value="left" ${fig.align === 'left' ? 'selected' : ''}>Left</option>
                </select>
              </div>

              <div class="form-group field-full">
                <label class="form-label" for="input-fig-caption">Caption (Optional, max 120 chars)</label>
                <input type="text" id="input-fig-caption" class="form-control form-control-sm" maxlength="120" placeholder="e.g. Fig. 1: Map of ancient trade routes" value="${escapeHtml(fig.caption || '')}" />
              </div>
            </div>
          </div>
        </div>
      `;

      const btnRemove = figContainer.querySelector('#btn-remove-figure');
      if (btnRemove) {
        btnRemove.addEventListener('click', () => {
          this.currentData.figure = null;
          this.renderFigureBox();
        });
      }

      const selWidth = figContainer.querySelector('#select-fig-width');
      if (selWidth) {
        selWidth.addEventListener('change', (e) => {
          if (this.currentData.figure) {
            this.currentData.figure.widthPct = Number(e.target.value);
          }
        });
      }

      const selAlign = figContainer.querySelector('#select-fig-align');
      if (selAlign) {
        selAlign.addEventListener('change', (e) => {
          if (this.currentData.figure) {
            this.currentData.figure.align = e.target.value;
          }
        });
      }

      const inpCaption = figContainer.querySelector('#input-fig-caption');
      if (inpCaption) {
        inpCaption.addEventListener('input', (e) => {
          if (this.currentData.figure) {
            this.currentData.figure.caption = e.target.value;
          }
        });
      }
    } else {
      figContainer.innerHTML = `
        <div class="figure-editor-box">
          <div class="figure-editor-header">
            <div class="figure-editor-title">
              <span>🖼️</span>
              <span>Question Figure (Optional)</span>
            </div>
          </div>
          <div id="figure-dropzone" class="figure-dropzone">
            <div style="font-size: 20px; margin-bottom: 4px;">📷</div>
            <div><strong>Drop PNG or JPEG image here</strong>, paste with <strong>Ctrl+V</strong>, or <span style="color: var(--color-primary-600); text-decoration: underline;">browse file</span></div>
            <div style="font-size: 11px; color: var(--color-text-dim); margin-top: 4px;">Max decoded size: 1.5 MB (auto-scaled to max 1200px width)</div>
            <input type="file" id="input-figure-file" accept="image/png,image/jpeg" style="display: none;" />
          </div>
          <div id="figure-error-msg" style="display: none; margin-top: 8px; color: var(--color-danger-text); font-size: 12px;"></div>
        </div>
      `;

      const dropzone = figContainer.querySelector('#figure-dropzone');
      const fileInput = figContainer.querySelector('#input-figure-file');

      if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file) this.processImageFile(file);
          fileInput.value = '';
        });

        dropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
          dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
          const file = e.dataTransfer?.files?.[0];
          if (file) this.processImageFile(file);
        });
      }
    }
  }

  showFigureError(msg) {
    const errBox = this.modalEl?.querySelector('#figure-error-msg');
    if (errBox) {
      errBox.textContent = msg;
      errBox.style.display = 'block';
    } else {
      ModalService.toast(msg, 'warning');
    }
  }

  processImageFile(file) {
    if (!file) return;

    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      this.showFigureError('Unsupported image format. Please select a PNG or JPEG file (SVG, WebP, etc. are rejected).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1200;
        let w = img.width;
        let h = img.height;

        if (w > maxWidth) {
          const scale = maxWidth / w;
          w = maxWidth;
          h = Math.round(img.height * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        let finalDataUrl = canvas.toDataURL('image/png');
        const b64 = finalDataUrl.split(',')[1] || '';
        const byteLen = Math.round(b64.length * 3 / 4);

        // If PNG exceeds 400 KB, re-encode as JPEG at quality 0.85
        if (byteLen > 400 * 1024) {
          finalDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        }

        const checkB64 = finalDataUrl.split(',')[1] || '';
        const finalBytes = Math.round(checkB64.length * 3 / 4);
        if (finalBytes > 1572864) {
          this.showFigureError('The processed image exceeds the 1.5 MB contract limit. Please use a smaller image.');
          return;
        }

        this.syncFormToData();
        this.currentData.figure = {
          src: finalDataUrl,
          widthPct: this.currentData.figure?.widthPct || 50,
          align: this.currentData.figure?.align || 'center',
          caption: this.currentData.figure?.caption || ''
        };
        this.renderFigureBox();
      };

      img.onerror = () => {
        this.showFigureError('Failed to load image file.');
      };

      img.src = dataUrl;
    };

    reader.onerror = () => {
      this.showFigureError('Failed to read file from system.');
    };

    reader.readAsDataURL(file);
  }

  bindDynamicEvents() {
    // Track last focused input for math palette insertion
    this.modalEl.querySelectorAll('input[type="text"], textarea').forEach(input => {
      input.addEventListener('focus', () => {
        this.lastFocusedInput = input;
      });
    });

    // Passage dynamic sub-questions
    const btnAddSq = this.modalEl.querySelector('#btn-add-subquestion');
    if (btnAddSq) {
      btnAddSq.addEventListener('click', () => {
        this.syncFormToData();
        if (!Array.isArray(this.currentData.subQuestions)) {
          this.currentData.subQuestions = [];
        }
        this.currentData.subQuestions.push({ text: '', marks: 2 });
        this.renderDynamicFields();
      });
    }

    this.modalEl.querySelectorAll('.btn-remove-sq').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.index);
        this.syncFormToData();
        this.currentData.subQuestions.splice(idx, 1);
        if (this.currentData.subQuestions.length === 0) {
          this.currentData.subQuestions.push({ text: '', marks: 2 });
        }
        this.renderDynamicFields();
      });
    });

    // Map dynamic places
    const btnAddPlace = this.modalEl.querySelector('#btn-add-place');
    if (btnAddPlace) {
      btnAddPlace.addEventListener('click', () => {
        this.syncFormToData();
        if (!Array.isArray(this.currentData.places)) {
          this.currentData.places = [];
        }
        this.currentData.places.push('');
        this.renderDynamicFields();
      });
    }

    this.modalEl.querySelectorAll('.btn-remove-place').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.index);
        this.syncFormToData();
        this.currentData.places.splice(idx, 1);
        if (this.currentData.places.length === 0) {
          this.currentData.places.push('');
        }
        this.renderDynamicFields();
      });
    });
  }

  syncFormToData() {
    const type = this.currentData.type;

    if (type === 'mcq') {
      const textInput = this.modalEl.querySelector('#input-question-text');
      if (textInput) this.currentData.text = textInput.value;

      const opts = [];
      this.modalEl.querySelectorAll('.opt-input').forEach(inp => {
        opts.push(inp.value);
      });
      this.currentData.options = opts;
    } else if (type === 'sequence') {
      const textInput = this.modalEl.querySelector('#input-question-text');
      if (textInput) this.currentData.text = textInput.value;

      const items = [];
      this.modalEl.querySelectorAll('.seq-item-input').forEach(inp => {
        items.push(inp.value);
      });
      this.currentData.items = items;

      const opts = [];
      this.modalEl.querySelectorAll('.seq-opt-input').forEach(inp => {
        opts.push(inp.value);
      });
      this.currentData.options = opts;
    } else if (type === 'assertion_reason') {
      const assertionInp = this.modalEl.querySelector('#input-assertion');
      const reasonInp = this.modalEl.querySelector('#input-reason');
      if (assertionInp) this.currentData.assertion = assertionInp.value;
      if (reasonInp) this.currentData.reason = reasonInp.value;

      const opts = [];
      this.modalEl.querySelectorAll('.ar-opt-input').forEach(inp => {
        opts.push(inp.value);
      });
      this.currentData.options = opts;
    } else if (type === 'match') {
      const textInput = this.modalEl.querySelector('#input-question-text');
      if (textInput) this.currentData.text = textInput.value;

      const colA = [];
      this.modalEl.querySelectorAll('.match-col-a-input').forEach(inp => {
        colA.push(inp.value);
      });
      this.currentData.columnA = colA;

      const colB = [];
      this.modalEl.querySelectorAll('.match-col-b-input').forEach(inp => {
        colB.push(inp.value);
      });
      this.currentData.columnB = colB;

      const opts = [];
      this.modalEl.querySelectorAll('.match-opt-input').forEach(inp => {
        opts.push(inp.value);
      });
      this.currentData.options = opts;
    } else if (type === 'short' || type === 'long') {
      const textInput = this.modalEl.querySelector('#input-question-text');
      if (textInput) this.currentData.text = textInput.value;
    } else if (type === 'passage') {
      const passageInp = this.modalEl.querySelector('#input-passage-text');
      if (passageInp) this.currentData.passage = passageInp.value;

      const subQuestions = [];
      const rows = this.modalEl.querySelectorAll('#subquestions-list .dynamic-row');
      rows.forEach(r => {
        const textInp = r.querySelector('.sq-text-input');
        const marksInp = r.querySelector('.sq-marks-input');
        subQuestions.push({
          text: textInp ? textInp.value : '',
          marks: marksInp ? Number(marksInp.value) || 1 : 1
        });
      });
      this.currentData.subQuestions = subQuestions;
    } else if (type === 'map') {
      const textInput = this.modalEl.querySelector('#input-question-text');
      if (textInput) this.currentData.text = textInput.value;

      const places = [];
      this.modalEl.querySelectorAll('.map-place-input').forEach(inp => {
        places.push(inp.value);
      });
      this.currentData.places = places;
    }

    // Sync figure properties if figure is present
    if (this.currentData.figure && this.modalEl) {
      const widthSel = this.modalEl.querySelector('#select-fig-width');
      const alignSel = this.modalEl.querySelector('#select-fig-align');
      const capInp = this.modalEl.querySelector('#input-fig-caption');
      if (widthSel) this.currentData.figure.widthPct = Number(widthSel.value);
      if (alignSel) this.currentData.figure.align = alignSel.value;
      if (capInp) this.currentData.figure.caption = capInp.value;
    }
  }

  handleSave() {
    this.syncFormToData();

    const validation = validateQuestion(this.currentData);
    const alertBox = this.modalEl.querySelector('#form-validation-alert');

    if (!validation.isValid) {
      if (alertBox) {
        alertBox.innerHTML = `<strong>Please fix the following:</strong><br>${validation.errors.map(e => escapeHtml(e)).join('<br>')}`;
        alertBox.style.display = 'block';
      }
      return false; // Prevent modal closing
    }

    if (alertBox) alertBox.style.display = 'none';
    store.saveActiveEditingQuestion(this.currentData);
    ModalService.toast(this.isNew ? 'Question added!' : 'Question updated!', 'success');
    return true; // Closes modal
  }
}
