/**
 * Central Reactive State Manager
 * Coordinates paper data, section selection, question editing, style settings, and preview status.
 */

import { SAMPLE_PAPER } from './sampleData.js';
import { StorageService } from './utils/storage.js';

class StateStore {
  constructor() {
    this.listeners = new Set();
    this.previewDebounceTimer = null;

    // Load initial paper from LocalStorage if available, otherwise use sample paper
    const saved = StorageService.loadPaper();
    this.paper = saved || JSON.parse(JSON.stringify(SAMPLE_PAPER));
    this.ensureStyleDefaults();

    this.activeSectionIndex = 0;
    this.editingQuestion = null; // { sectionIndex, questionIndex, isNew, data }

    this.isDirty = false;
    this.lastSavedTime = StorageService.getLastSavedTime();

    this.backendStatus = 'checking'; // 'online' | 'offline' | 'checking'
    this.previewStatus = 'idle'; // 'idle' | 'loading' | 'success' | 'error'
    this.previewSource = 'client'; // 'backend' | 'client'
    this.previewHtml = '';
    this.previewError = null;
    this.zoomLevel = 1.0;
  }

  ensureStyleDefaults() {
    if (!this.paper.style || typeof this.paper.style !== 'object' || Array.isArray(this.paper.style)) {
      this.paper.style = { fontFamily: 'Times New Roman', fontSize: 11 };
    } else {
      if (!this.paper.style.fontFamily) {
        this.paper.style.fontFamily = 'Times New Roman';
      }
      if (this.paper.style.fontSize === undefined || this.paper.style.fontSize === null) {
        this.paper.style.fontSize = 11;
      } else {
        const num = Number(this.paper.style.fontSize);
        this.paper.style.fontSize = isNaN(num) ? 11 : num;
      }
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(eventType = 'change', payload = null) {
    for (const listener of this.listeners) {
      try {
        listener(eventType, this, payload);
      } catch (err) {
        console.error('State listener error:', err);
      }
    }
  }

  // --- Paper Style mutations ---
  updateStyle(field, value) {
    this.ensureStyleDefaults();
    this.paper.style[field] = field === 'fontSize' ? (Number(value) || 11) : value;
    this.markDirty();
    this.notify('style_change', { field, value: this.paper.style[field] });
  }

  // --- Header mutations ---
  updateHeaderField(field, value) {
    this.paper[field] = value;
    this.markDirty();
    this.notify('header_change', { field, value });
  }

  // --- Section mutations ---
  addSection(label = null, marksPerQuestion = 1, instruction = '') {
    const existingLabels = (this.paper.sections || []).map(s => s.label);
    let nextLabel = label;
    if (!nextLabel) {
      const candidates = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      nextLabel = candidates.find(c => !existingLabels.includes(c)) || String.fromCharCode(65 + this.paper.sections.length);
    }

    const newSection = {
      label: nextLabel,
      marksPerQuestion: Number(marksPerQuestion) || 1,
      instruction: instruction || '',
      questions: []
    };

    if (!Array.isArray(this.paper.sections)) {
      this.paper.sections = [];
    }

    this.paper.sections.push(newSection);
    this.activeSectionIndex = this.paper.sections.length - 1;
    this.markDirty();
    this.notify('section_added', { section: newSection, index: this.activeSectionIndex });
  }

  updateSection(index, updates) {
    if (!this.paper.sections[index]) return;
    Object.assign(this.paper.sections[index], updates);
    this.markDirty();
    this.notify('section_updated', { index, updates });
  }

  deleteSection(index) {
    if (!this.paper.sections || !this.paper.sections[index]) return;
    this.paper.sections.splice(index, 1);
    if (this.activeSectionIndex >= this.paper.sections.length) {
      this.activeSectionIndex = Math.max(0, this.paper.sections.length - 1);
    }
    this.markDirty();
    this.notify('section_deleted', { index });
  }

  setActiveSection(index) {
    if (index >= 0 && index < (this.paper.sections?.length || 0)) {
      this.activeSectionIndex = index;
      this.notify('active_section_change', { index });
    }
  }

  // --- Question mutations ---
  addQuestion(sectionIndex, questionData) {
    const section = this.paper.sections[sectionIndex];
    if (!section) return;
    if (!Array.isArray(section.questions)) {
      section.questions = [];
    }
    section.questions.push(JSON.parse(JSON.stringify(questionData)));
    this.markDirty();
    this.notify('question_added', { sectionIndex, questionIndex: section.questions.length - 1 });
  }

  updateQuestion(sectionIndex, questionIndex, questionData) {
    const section = this.paper.sections[sectionIndex];
    if (!section || !section.questions[questionIndex]) return;
    section.questions[questionIndex] = JSON.parse(JSON.stringify(questionData));
    this.markDirty();
    this.notify('question_updated', { sectionIndex, questionIndex });
  }

  deleteQuestion(sectionIndex, questionIndex) {
    const section = this.paper.sections[sectionIndex];
    if (!section || !section.questions[questionIndex]) return;
    section.questions.splice(questionIndex, 1);
    this.markDirty();
    this.notify('question_deleted', { sectionIndex, questionIndex });
  }

  moveQuestion(sectionIndex, questionIndex, direction) {
    const section = this.paper.sections[sectionIndex];
    if (!section) return;
    const targetIndex = questionIndex + direction;
    if (targetIndex < 0 || targetIndex >= section.questions.length) return;

    const [moved] = section.questions.splice(questionIndex, 1);
    section.questions.splice(targetIndex, 0, moved);
    this.markDirty();
    this.notify('question_reordered', { sectionIndex, from: questionIndex, to: targetIndex });
  }

  // --- Question Editing Modal state ---
  openQuestionEditor(sectionIndex, questionIndex = null, defaultType = 'mcq') {
    let questionData;
    let isNew = false;

    if (questionIndex !== null && this.paper.sections[sectionIndex]?.questions[questionIndex]) {
      questionData = JSON.parse(JSON.stringify(this.paper.sections[sectionIndex].questions[questionIndex]));
    } else {
      isNew = true;
      questionData = this.getDefaultQuestionTemplate(defaultType);
    }

    this.editingQuestion = {
      sectionIndex,
      questionIndex,
      isNew,
      data: questionData
    };
    this.notify('open_question_modal', this.editingQuestion);
  }

  closeQuestionEditor() {
    this.editingQuestion = null;
    this.notify('close_question_modal');
  }

  saveActiveEditingQuestion(data) {
    if (!this.editingQuestion) return;
    const { sectionIndex, questionIndex, isNew } = this.editingQuestion;
    if (isNew) {
      this.addQuestion(sectionIndex, data);
    } else {
      this.updateQuestion(sectionIndex, questionIndex, data);
    }
    this.closeQuestionEditor();
  }

  // --- Entire paper replacement ---
  loadPaper(newPaper) {
    this.paper = JSON.parse(JSON.stringify(newPaper));
    this.ensureStyleDefaults();
    this.activeSectionIndex = 0;
    this.editingQuestion = null;
    this.markDirty();
    this.notify('paper_loaded');
  }

  resetToSample() {
    this.loadPaper(SAMPLE_PAPER);
  }

  clearPaper() {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    this.paper = {
      school: '',
      exam: '',
      class: '',
      subject: '',
      time: '',
      totalMarks: '',
      style: { fontFamily: 'Times New Roman', fontSize: 11 },
      sections: []
    };
    this.activeSectionIndex = 0;
    this.editingQuestion = null;
    this.isDirty = false;
    StorageService.savePaper(this.paper);
    this.notify('paper_loaded');
    this.notify('saved_state');
    this.notify('reset_zoom');
  }

  // --- Autosave & Dirty tracking ---
  markDirty() {
    this.isDirty = true;
    this.notify('dirty_state', { isDirty: true });
    this.scheduleAutosave();
  }

  scheduleAutosave() {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
    }
    this.autosaveTimer = setTimeout(() => {
      const res = StorageService.savePaper(this.paper);
      if (res.success) {
        this.isDirty = false;
        this.lastSavedTime = res.timestamp;
        this.notify('saved_state', { timestamp: res.timestamp });
      } else {
        this.notify('autosave_failed', { isQuotaExceeded: res.isQuotaExceeded, error: res.error });
      }
    }, 1000);
  }

  // --- Marks summary calculation ---
  calculateMarksSummary() {
    let calculatedTotal = 0;
    const sectionSummaries = (this.paper.sections || []).map(s => {
      const per = Number(s.marksPerQuestion) || 0;
      const count = (s.questions || []).length;
      const total = per * count;
      calculatedTotal += total;
      return {
        label: s.label,
        marksPerQuestion: per,
        count,
        total
      };
    });

    const targetTotal = Number(this.paper.totalMarks) || 0;
    return {
      targetTotal,
      calculatedTotal,
      isMatch: targetTotal === calculatedTotal,
      difference: calculatedTotal - targetTotal,
      sectionSummaries
    };
  }

  // --- Default Question Templates for All 8 Types ---
  getDefaultQuestionTemplate(type) {
    switch (type) {
      case 'mcq':
        return {
          type: 'mcq',
          text: '',
          options: ['', '', '', '']
        };
      case 'sequence':
        return {
          type: 'sequence',
          text: 'Arrange the following events in chronological order:',
          items: ['', '', '', ''],
          options: [
            '(i) → (ii) → (iii) → (iv)',
            '(ii) → (i) → (iv) → (iii)',
            '(iii) → (ii) → (i) → (iv)',
            '(iv) → (iii) → (ii) → (i)'
          ]
        };
      case 'assertion_reason':
        return {
          type: 'assertion_reason',
          assertion: '',
          reason: '',
          options: [
            'Both A and R are true, and R is the correct explanation of A.',
            'Both A and R are true, but R is not the correct explanation of A.',
            'A is true, but R is false.',
            'A is false, but R is true.'
          ]
        };
      case 'match':
        return {
          type: 'match',
          text: 'Match the following',
          columnA: ['', '', '', ''],
          columnB: ['', '', '', ''],
          options: [
            '(1-a) (2-b) (3-c) (4-d)',
            '(1-b) (2-a) (3-d) (4-c)',
            '(1-c) (2-d) (3-a) (4-b)',
            '(1-d) (2-c) (3-b) (4-a)'
          ]
        };
      case 'short':
        return {
          type: 'short',
          text: ''
        };
      case 'long':
        return {
          type: 'long',
          text: ''
        };
      case 'passage':
        return {
          type: 'passage',
          passage: '',
          subQuestions: [
            { text: '', marks: 2 },
            { text: '', marks: 2 }
          ]
        };
      case 'map':
        return {
          type: 'map',
          text: 'Locate the following places in an Outline map of India',
          places: ['', '', '', '']
        };
      default:
        return {
          type: 'mcq',
          text: '',
          options: ['', '', '', '']
        };
    }
  }
}

export const store = new StateStore();
