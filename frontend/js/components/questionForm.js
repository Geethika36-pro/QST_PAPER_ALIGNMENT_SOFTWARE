/**
 * Question Editor Modal Component
 * Supports all 8 Question Types:
 * MCQ, Sequence, Assertion-Reason, Match, Short, Long, Passage, Map.
 */

import { store } from '../state.js';
import { validateQuestion } from '../validator.js';
import { ModalService } from './modal.js';

export class QuestionFormComponent {
  constructor() {
    this.modalEl = null;
    this.currentData = null;
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

    const section = store.paper.sections[sectionIndex];
    const secLabel = section?.label || 'A';
    const title = isNew
      ? `Add New Question — Section ${secLabel}`
      : `Edit Question — Section ${secLabel}`;

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

        <!-- Dynamic Form Fields Area -->
        <div id="dynamic-fields-area"></div>

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

    // Make modal wider for questions
    const modalWindow = this.modalEl.querySelector('.modal-window');
    if (modalWindow) {
      modalWindow.classList.add('modal-window-lg');
    }

    // Set initial type and render dynamic fields
    const selectType = this.modalEl.querySelector('#select-question-type');
    selectType.value = this.currentData.type || 'mcq';

    selectType.addEventListener('change', (e) => {
      this.handleTypeChange(e.target.value);
    });

    this.renderDynamicFields();
  }

  close() {
    ModalService.closeModal();
    this.modalEl = null;
  }

  handleTypeChange(newType) {
    // Preserve existing question text where applicable
    const preservedText = this.collectCurrentText();
    const template = store.getDefaultQuestionTemplate(newType);

    if (preservedText && (newType !== 'assertion_reason')) {
      template.text = preservedText;
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
          <textarea id="input-question-text" class="form-control" rows="2" placeholder="e.g. Which island in the Andaman and Nicobar Islands is home to the only active volcano in India?">${q.text || ''}</textarea>
        </div>

        <div class="sub-box">
          <div class="sub-box-title">Multiple Choice Options</div>
          <div class="options-grid-inputs">
            <div class="option-input-item">
              <span class="option-prefix">A)</span>
              <input type="text" class="form-control form-control-sm opt-input" data-index="0" value="${opts[0] || ''}" placeholder="Option A" />
            </div>
            <div class="option-input-item">
              <span class="option-prefix">B)</span>
              <input type="text" class="form-control form-control-sm opt-input" data-index="1" value="${opts[1] || ''}" placeholder="Option B" />
            </div>
            <div class="option-input-item">
              <span class="option-prefix">C)</span>
              <input type="text" class="form-control form-control-sm opt-input" data-index="2" value="${opts[2] || ''}" placeholder="Option C" />
            </div>
            <div class="option-input-item">
              <span class="option-prefix">D)</span>
              <input type="text" class="form-control form-control-sm opt-input" data-index="3" value="${opts[3] || ''}" placeholder="Option D" />
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
          <input type="text" class="form-control form-control-sm seq-item-input" data-index="${i}" value="${items[i] || ''}" placeholder="Event ${roman[i]}" />
        </div>
      `).join('');

      const choicesHtml = [0, 1, 2, 3].map(i => `
        <div class="option-input-item">
          <span class="option-prefix">${'ABCD'[i]}.</span>
          <input type="text" class="form-control form-control-sm seq-opt-input" data-index="${i}" value="${opts[i] || ''}" placeholder="e.g. (ii) → (iv) → (iii) → (i)" />
        </div>
      `).join('');

      html = `
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label form-label-required" for="input-question-text">Question Instruction</label>
          <input type="text" id="input-question-text" class="form-control" value="${q.text || 'Arrange the following events in chronological order:'}" />
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
          <input type="text" class="form-control form-control-sm ar-opt-input" data-index="${i}" value="${opts[i] || ''}" />
        </div>
      `).join('');

      html = `
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label form-label-required" for="input-assertion">Assertion (A)</label>
          <textarea id="input-assertion" class="form-control" rows="2" placeholder="e.g. The introduction of coins was a major step forward from the barter system.">${q.assertion || ''}</textarea>
        </div>

        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label form-label-required" for="input-reason">Reason (R)</label>
          <textarea id="input-reason" class="form-control" rows="2" placeholder="e.g. Coins made it easier to buy, sell, and store value compared to exchanging goods directly.">${q.reason || ''}</textarea>
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
          <input type="text" class="form-control form-control-sm match-col-a-input" data-index="${i}" value="${colA[i] || ''}" placeholder="Entry ${i + 1}" />
        </div>
      `).join('');

      const colBHtml = [0, 1, 2, 3].map(i => `
        <div class="option-input-item">
          <span class="option-prefix">(${abcd[i]})</span>
          <input type="text" class="form-control form-control-sm match-col-b-input" data-index="${i}" value="${colB[i] || ''}" placeholder="Match (${abcd[i]})" />
        </div>
      `).join('');

      const choicesHtml = [0, 1, 2, 3].map(i => `
        <div class="option-input-item">
          <span class="option-prefix">${'ABCD'[i]}.</span>
          <input type="text" class="form-control form-control-sm match-opt-input" data-index="${i}" value="${opts[i] || ''}" placeholder="e.g. (1-c) (2-d) (3-b) (4-a)" />
        </div>
      `).join('');

      html = `
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label form-label-required" for="input-question-text">Instruction</label>
          <input type="text" id="input-question-text" class="form-control" value="${q.text || 'Match the following'}" />
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
          <textarea id="input-question-text" class="form-control" rows="${isLong ? 4 : 2}" placeholder="Enter examination question text here...">${q.text || ''}</textarea>
        </div>
      `;
    } else if (type === 'passage') {
      const subQuestions = q.subQuestions || [{ text: '', marks: 2 }];
      const subHtml = subQuestions.map((sq, idx) => `
        <div class="dynamic-row" data-index="${idx}">
          <span class="dynamic-row-num">${idx + 1}.</span>
          <input type="text" class="form-control sq-text-input" value="${sq.text || ''}" placeholder="Sub-question ${idx + 1}" />
          <div class="marks-input-wrapper">
            <input type="number" class="form-control form-control-sm sq-marks-input" value="${sq.marks ?? 2}" min="1" max="20" title="Marks" />
          </div>
          <button type="button" class="btn btn-danger btn-sm btn-remove-sq" data-index="${idx}" title="Remove sub-question">✕</button>
        </div>
      `).join('');

      html = `
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label form-label-required" for="input-passage-text">Passage Text</label>
          <textarea id="input-passage-text" class="form-control" rows="4" placeholder="Read the following paragraph and answer the questions given below...">${q.passage || ''}</textarea>
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
          <input type="text" class="form-control map-place-input" value="${p || ''}" placeholder="Place ${idx + 1} to locate" />
          <button type="button" class="btn btn-danger btn-sm btn-remove-place" data-index="${idx}" title="Remove place">✕</button>
        </div>
      `).join('');

      html = `
        <div class="form-group" style="margin-bottom: 14px;">
          <label class="form-label form-label-required" for="input-question-text">Map Question Text</label>
          <input type="text" id="input-question-text" class="form-control" value="${q.text || 'Locate the following places in an Outline map of India'}" />
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
    this.bindDynamicEvents();
  }

  bindDynamicEvents() {
    const q = this.currentData;

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
  }

  handleSave() {
    this.syncFormToData();

    const validation = validateQuestion(this.currentData);
    const alertBox = this.modalEl.querySelector('#form-validation-alert');

    if (!validation.isValid) {
      if (alertBox) {
        alertBox.innerHTML = `<strong>Please fix the following:</strong><br>${validation.errors.join('<br>')}`;
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
