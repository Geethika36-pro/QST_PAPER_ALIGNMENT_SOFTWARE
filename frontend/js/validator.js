/**
 * Question Paper Schema Validator
 * Verifies that the JSON paper structure adheres to the required CBSE/ICSE format
 */

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

  // Sections validation
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
      }
    });
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
