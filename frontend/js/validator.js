/**
 * Question Paper Schema Validator
 * Verifies that the JSON paper structure adheres to the required CBSE/ICSE format
 * Validates paper-level style and question-level figures per contract.
 */

export const ALLOWED_FONTS = [
  'Times New Roman',
  'Arial',
  'Calibri',
  'Cambria',
  'Georgia',
  'Verdana',
  'Courier New'
];

export const ALLOWED_SIZES = [9, 10, 10.5, 11, 12, 13, 14];
export const ALLOWED_WIDTHS = [25, 40, 50, 65, 80, 100];
export const ALLOWED_ALIGNS = ['left', 'center'];
export const MAX_FIGURE_BYTES = 1572864; // 1.5 MB
export const MAX_FIGURES_COUNT = 12;

export function validateQuestionPaper(paper) {
  const errors = [];

  if (!paper || typeof paper !== 'object') {
    return { isValid: false, errors: ['Question paper data must be a valid JSON object.'] };
  }

  // Header validation
  if (!paper.school || typeof paper.school !== 'string' || !paper.school.trim()) {
    errors.push('School name is required.');
  }

  if (!paper.exam || typeof paper.exam !== 'string' || !paper.exam.trim()) {
    errors.push('Examination title is required.');
  }

  if (!paper.class || typeof paper.class !== 'string' || !paper.class.trim()) {
    errors.push('Class is required.');
  }

  if (!paper.subject || typeof paper.subject !== 'string' || !paper.subject.trim()) {
    errors.push('Subject is required.');
  }

  // Style validation (optional)
  if (paper.style !== undefined && paper.style !== null) {
    if (typeof paper.style !== 'object' || Array.isArray(paper.style)) {
      errors.push('Style must be an object.');
    } else {
      if (paper.style.fontFamily && !ALLOWED_FONTS.includes(paper.style.fontFamily)) {
        errors.push(`fontFamily must be one of: ${ALLOWED_FONTS.join(', ')}`);
      }
      if (paper.style.fontSize !== undefined) {
        const numSize = Number(paper.style.fontSize);
        if (!ALLOWED_SIZES.includes(numSize)) {
          errors.push(`fontSize must be one of: ${ALLOWED_SIZES.join(', ')}`);
        }
      }
    }
  }

  // Sections validation & total figure count
  let totalFigures = 0;

  if (!Array.isArray(paper.sections)) {
    errors.push('Paper must include a "sections" array.');
  } else if (paper.sections.length === 0) {
    errors.push('Paper must have at least one section.');
  } else {
    paper.sections.forEach((sec, idx) => {
      const secName = `Section ${sec.label || idx + 1}`;
      if (!sec.label || typeof sec.label !== 'string') {
        errors.push(`${secName} is missing a section label.`);
      }
      if (typeof sec.marksPerQuestion !== 'number' || sec.marksPerQuestion <= 0) {
        errors.push(`${secName} marksPerQuestion must be a positive number.`);
      }
      if (!Array.isArray(sec.questions)) {
        errors.push(`${secName} must have a "questions" array.`);
      } else {
        sec.questions.forEach((q, qIdx) => {
          if (q && q.figure) {
            totalFigures += 1;
            const figVal = validateFigure(q.figure, `${secName} Q${qIdx + 1}`);
            if (!figVal.isValid) {
              errors.push(...figVal.errors);
            }
          }
        });
      }
    });
  }

  if (totalFigures > MAX_FIGURES_COUNT) {
    errors.push(`Paper exceeds maximum limit of ${MAX_FIGURES_COUNT} figures (found ${totalFigures}).`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateFigure(fig, context = 'Figure') {
  const errors = [];
  if (!fig || typeof fig !== 'object' || Array.isArray(fig)) {
    return { isValid: false, errors: [`${context}: Figure must be an object.`] };
  }

  const src = fig.src;
  if (!src || typeof src !== 'string') {
    errors.push(`${context}: Figure src is required and must be a string.`);
  } else {
    const isPng = src.startsWith('data:image/png;base64,');
    const isJpeg = src.startsWith('data:image/jpeg;base64,');
    if (!isPng && !isJpeg) {
      errors.push(`${context}: Image source must be a base64 PNG or JPEG data URI.`);
    } else {
      const prefix = isPng ? 'data:image/png;base64,' : 'data:image/jpeg;base64,';
      const b64 = src.slice(prefix.length);
      try {
        const decodedBytes = Math.round(b64.length * 3 / 4);
        if (decodedBytes > MAX_FIGURE_BYTES) {
          errors.push(`${context}: Figure size exceeds 1.5 MB limit.`);
        }
      } catch {
        errors.push(`${context}: Invalid base64 in figure src.`);
      }
    }
  }

  if (fig.widthPct !== undefined && fig.widthPct !== null) {
    const w = Number(fig.widthPct);
    if (!ALLOWED_WIDTHS.includes(w)) {
      errors.push(`${context}: widthPct must be one of: ${ALLOWED_WIDTHS.join(', ')}.`);
    }
  }

  if (fig.align !== undefined && fig.align !== null) {
    if (!ALLOWED_ALIGNS.includes(fig.align)) {
      errors.push(`${context}: align must be one of: ${ALLOWED_ALIGNS.join(', ')}.`);
    }
  }

  if (fig.caption !== undefined && fig.caption !== null) {
    if (typeof fig.caption !== 'string' || fig.caption.length > 120) {
      errors.push(`${context}: Caption cannot exceed 120 characters.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates a single question based on its type
 */
export function validateQuestion(q) {
  const errors = [];
  if (!q || !q.type) {
    return { isValid: false, errors: ['Question type is required.'] };
  }

  const validTypes = ['mcq', 'sequence', 'assertion_reason', 'match', 'short', 'long', 'passage', 'map'];
  if (!validTypes.includes(q.type)) {
    return { isValid: false, errors: [`Unknown question type "${q.type}".`] };
  }

  if (q.figure) {
    const figVal = validateFigure(q.figure, 'Question Figure');
    if (!figVal.isValid) {
      errors.push(...figVal.errors);
    }
  }

  switch (q.type) {
    case 'mcq':
      if (!q.text?.trim()) errors.push('MCQ question text is required.');
      if (!Array.isArray(q.options) || q.options.filter(o => o?.trim()).length < 2) {
        errors.push('MCQ must have at least 2 non-empty options.');
      }
      break;

    case 'sequence':
      if (!q.text?.trim()) errors.push('Sequence question text is required.');
      if (!Array.isArray(q.items) || q.items.filter(i => i?.trim()).length < 2) {
        errors.push('Sequence question must have at least 2 sequence events.');
      }
      if (!Array.isArray(q.options) || q.options.filter(o => o?.trim()).length < 2) {
        errors.push('Sequence question must have answer choices.');
      }
      break;

    case 'assertion_reason':
      if (!q.assertion?.trim()) errors.push('Assertion (A) is required.');
      if (!q.reason?.trim()) errors.push('Reason (R) is required.');
      if (!Array.isArray(q.options) || q.options.filter(o => o?.trim()).length < 2) {
        errors.push('Assertion-Reason must have answer choices.');
      }
      break;

    case 'match':
      if (!Array.isArray(q.columnA) || q.columnA.filter(a => a?.trim()).length < 2) {
        errors.push('Column A must have at least 2 items.');
      }
      if (!Array.isArray(q.columnB) || q.columnB.filter(b => b?.trim()).length < 2) {
        errors.push('Column B must have at least 2 items.');
      }
      break;

    case 'short':
    case 'long':
      if (!q.text?.trim()) errors.push('Question text is required.');
      break;

    case 'passage':
      if (!q.passage?.trim()) errors.push('Passage text is required.');
      if (!Array.isArray(q.subQuestions) || q.subQuestions.length === 0) {
        errors.push('Passage question must have at least one sub-question.');
      }
      break;

    case 'map':
      if (!q.text?.trim()) errors.push('Map question text is required.');
      if (!Array.isArray(q.places) || q.places.filter(p => p?.trim()).length === 0) {
        errors.push('Map question must have at least one place to locate.');
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
