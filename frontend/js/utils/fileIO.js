/**
 * File I/O Utilities: JSON Export & Import
 */

import { validateQuestionPaper } from '../validator.js';

export const FileIOService = {
  /**
   * Triggers download of the current question paper as a formatted .json file
   */
  exportPaper(paper) {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(paper, null, 2));
      const cleanSchool = (paper.school || 'question_paper')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .slice(0, 30);
      const filename = `${cleanSchool}_exam_paper.json`;

      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      return { success: true, filename };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Prompts user to select a JSON file and parses/validates it
   */
  importPaperFromFile(file) {
    return new Promise((resolve) => {
      if (!file) {
        return resolve({ success: false, error: 'No file selected.' });
      }

      if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        return resolve({ success: false, error: 'Selected file must be a .json file.' });
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const content = event.target.result;
          const paper = JSON.parse(content);
          const validation = validateQuestionPaper(paper);

          if (!validation.isValid) {
            return resolve({
              success: false,
              error: 'Invalid question paper format.',
              validationErrors: validation.errors
            });
          }

          resolve({ success: true, paper });
        } catch (parseErr) {
          resolve({
            success: false,
            error: `JSON Syntax Error: ${parseErr.message}`
          });
        }
      };

      reader.onerror = () => {
        resolve({ success: false, error: 'Failed to read file from disk.' });
      };

      reader.readAsText(file);
    });
  }
};
