/**
 * LocalStorage Autosave & Session Storage Utilities
 */

const STORAGE_KEY = 'qp_alignment_saved_paper';
const LAST_SAVED_KEY = 'qp_alignment_last_saved_time';

export const StorageService = {
  savePaper(paper) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(paper));
      const timestamp = new Date().toISOString();
      localStorage.setItem(LAST_SAVED_KEY, timestamp);
      return { success: true, timestamp };
    } catch (err) {
      console.warn('LocalStorage save failed:', err);
      return { success: false, error: err.message };
    }
  },

  loadPaper() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (err) {
      console.warn('LocalStorage load failed:', err);
      return null;
    }
  },

  getLastSavedTime() {
    return localStorage.getItem(LAST_SAVED_KEY);
  },

  clearSavedPaper() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LAST_SAVED_KEY);
    } catch (err) {
      console.warn('LocalStorage clear failed:', err);
    }
  }
};
