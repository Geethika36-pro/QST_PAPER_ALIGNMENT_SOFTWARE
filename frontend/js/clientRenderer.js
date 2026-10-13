/**
 * Client-Side Preview Renderer (Fallback & Demo Mode)
 * Faithfully mirrors app/render.py and templates/paper.html + static/paper.css
 * Used when backend is offline or in demo mode.
 */

const PAPER_CSS = `@page {
  size: A4;
  margin: 18mm 15mm;
  @bottom-center { content: 'Page ' counter(page) ' of ' counter(pages); font-size: 9pt; }
}
body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.35; margin: 0; padding: 18mm 15mm; background: #fff; color: #000; box-sizing: border-box; }
.paper-head { text-align: center; margin-bottom: 8px; }
.paper-head h1 { font-size: 14pt; margin: 0; text-transform: uppercase; }
.paper-head h2 { font-size: 12pt; margin: 2px 0 6px; }
.meta { display: flex; justify-content: space-between; font-weight: bold; margin-top: 6px; }
section h3 {
  display: flex; justify-content: space-between;
  font-size: 11.5pt; margin: 14px 0 4px; border-bottom: 1px solid #000;
  padding-bottom: 2px;
}
.instruction { font-style: italic; margin: 2px 0 6px; }
.q { margin: 6px 0; break-inside: avoid; }
.q p { margin: 0; }
.unknown { color: #b00; border: 1px dashed #b00; padding: 2px 6px; }

.opts-grid { display: flex; flex-wrap: wrap; margin: 2px 0 0 18px; }
.opts-grid span { width: 50%; box-sizing: border-box; padding-right: 12px; }
.opts-list { margin: 2px 0 0 18px; }
.seq-items { margin: 2px 0 2px 18px; }
.reason { margin-top: 2px; }
.passage { text-align: justify; margin: 4px 0; }
.sub { margin: 2px 0 2px 18px; }
.subm { float: right; font-weight: bold; }
table.match { border-collapse: collapse; width: 90%; margin: 4px 0 4px 18px; }
table.match th, table.match td { border: 1px solid #000; padding: 3px 6px; text-align: left; }
`;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderPartial(row) {
  const { no, q } = row;
  const qtype = q.type || 'unknown';

  if (qtype === 'mcq') {
    const opts = (q.options || []).map((o, idx) => {
      const letter = 'ABCDEFGH'[idx] || '';
      return `<span>${letter}) ${escapeHtml(o)}</span>`;
    }).join('\n    ');
    return `<div class='q'>
  <p><b>${no}.</b> ${escapeHtml(q.text)}</p>
  <div class='opts-grid'>
    ${opts}
  </div>
</div>`;
  }

  if (qtype === 'sequence') {
    const roman = ['i', 'ii', 'iii', 'iv', 'v', 'vi'];
    const items = (q.items || []).map((it, idx) => {
      return `<p>(${roman[idx] || idx + 1}) ${escapeHtml(it)}</p>`;
    }).join('\n    ');
    const opts = (q.options || []).map((o, idx) => {
      const letter = 'ABCDEFGH'[idx] || '';
      return `<span>${letter}. ${escapeHtml(o)}</span>`;
    }).join('\n    ');
    return `<div class='q'>
  <p><b>${no}.</b> ${escapeHtml(q.text)}</p>
  <div class='seq-items'>
    ${items}
  </div>
  <div class='opts-grid'>
    ${opts}
  </div>
</div>`;
  }

  if (qtype === 'assertion_reason') {
    const opts = (q.options || []).map((o, idx) => {
      const letter = 'ABCD'[idx] || '';
      return `<p>${letter}) ${escapeHtml(o)}</p>`;
    }).join('\n    ');
    return `<div class='q'>
  <p><b>${no}.</b> Assertion (A): ${escapeHtml(q.assertion)}</p>
  <p class='reason'>Reason (R): ${escapeHtml(q.reason)}</p>
  <div class='opts-list'>
    ${opts}
  </div>
</div>`;
  }

  if (qtype === 'match') {
    const colA = q.columnA || [];
    const colB = q.columnB || [];
    const abcd = 'abcdefgh';
    let rowsHtml = '';
    colA.forEach((a, idx) => {
      const b = idx < colB.length ? colB[idx] : '';
      rowsHtml += `
    <tr>
      <td>${idx + 1}. ${escapeHtml(a)}</td>
      <td>(${abcd[idx] || ''}) ${escapeHtml(b)}</td>
    </tr>`;
    });

    const opts = (q.options || []).map((o, idx) => {
      const letter = 'ABCD'[idx] || '';
      return `<span>${letter}. ${escapeHtml(o)}</span>`;
    }).join('\n    ');

    return `<div class='q'>
  <p><b>${no}.</b> ${escapeHtml(q.text || 'Match the following')}</p>
  <table class='match'>
    <tr><th>Column A</th><th>Column B</th></tr>${rowsHtml}
  </table>
  <div class='opts-grid'>
    ${opts}
  </div>
</div>`;
  }

  if (qtype === 'short' || qtype === 'long') {
    return `<div class='q'>
  <p><b>${no}.</b> ${escapeHtml(q.text)}</p>
</div>`;
  }

  if (qtype === 'passage') {
    const subHtml = (q.subQuestions || []).map((sq, idx) => {
      return `<p class='sub'>${idx + 1}. ${escapeHtml(sq.text)} <span class='subm'>(${sq.marks ?? 1})</span></p>`;
    }).join('\n  ');
    return `<div class='q'>
  <p><b>${no}.</b> Read the following paragraph and answer the questions given below</p>
  <p class='passage'>${escapeHtml(q.passage)}</p>
  ${subHtml}
</div>`;
  }

  if (qtype === 'map') {
    const places = (q.places || []).map((p, idx) => {
      return `<span>${idx + 1}. ${escapeHtml(p)}</span>`;
    }).join('\n    ');
    return `<div class='q'>
  <p><b>${no}.</b> ${escapeHtml(q.text)}</p>
  <div class='opts-grid'>
    ${places}
  </div>
</div>`;
  }

  return `<div class='q unknown'><b>${no}.</b> Unknown question type [${escapeHtml(qtype)}]</div>`;
}

export function renderClientHtml(paper) {
  let number = 0;
  let sectionsHtml = '';

  (paper.sections || []).forEach(s => {
    const questions = s.questions || [];
    let rowsHtml = '';
    questions.forEach(q => {
      number += 1;
      rowsHtml += renderPartial({ no: number, q }) + '\n';
    });
    const per = s.marksPerQuestion ?? 1;
    const count = questions.length;
    const marksLine = `${per}×${count}=${per * count}`;
    const instructionHtml = s.instruction ? `<p class='instruction'>${escapeHtml(s.instruction)}</p>` : '';

    sectionsHtml += `
  <section>
    <h3><span>Section ${escapeHtml(s.label || '')}</span><span>${marksLine}</span></h3>
    ${instructionHtml}
    ${rowsHtml}
  </section>`;
  });

  return `<!doctype html>
<html>
<head>
  <meta charset='utf-8'>
  <style>${PAPER_CSS}</style>
</head>
<body>
  <header class='paper-head'>
    <h1>${escapeHtml(paper.school || '')}</h1>
    <h2>${escapeHtml(paper.exam || '')}</h2>
    <div class='meta'>
      <span>CLASS - ${escapeHtml(paper.class || '')} ${escapeHtml(paper.subject || '')}</span>
      <span>TIME - ${escapeHtml(paper.time || '')}</span>
      <span>MARKS - ${escapeHtml(paper.totalMarks || '')}</span>
    </div>
  </header>
${sectionsHtml}
</body>
</html>`;
}
