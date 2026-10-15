/**
 * Client-Side Preview Renderer (Fallback & Demo Mode)
 * Faithfully mirrors app/render.py and templates/paper.html + static/paper.css
 * Used when backend is offline or in demo mode.
 */

const FONT_STACKS = {
  'Times New Roman': "'Times New Roman', 'Liberation Serif', Tinos, serif",
  'Arial': "'Arial', 'Liberation Sans', Arimo, sans-serif",
  'Calibri': "'Calibri', Carlito, sans-serif",
  'Cambria': "'Cambria', Caladea, serif",
  'Georgia': "'Georgia', 'Liberation Serif', serif",
  'Verdana': "'Verdana', 'Liberation Sans', sans-serif",
  'Courier New': "'Courier New', 'Liberation Mono', monospace"
};

const BASE_CSS = `@page {
  size: A4;
  margin: 18mm 15mm;
  @bottom-center { content: 'Page ' counter(page) ' of ' counter(pages); font-size: 9pt; }
}
:root {
  --paper-font: 'Times New Roman', serif;
  --paper-size: 11pt;
}
body {
  font-family: var(--paper-font);
  font-size: var(--paper-size);
  line-height: 1.35;
  margin: 0;
  background: #fff;
  color: #000;
}
@media screen {
  body {
    padding: 18mm 15mm;
    box-sizing: border-box;
  }
}
.paper-head { text-align: center; margin-bottom: 8px; }
.paper-head h1 { font-size: calc(var(--paper-size) + 3pt); margin: 0; }
.paper-head h2 { font-size: calc(var(--paper-size) + 1pt); margin: 2px 0 6px; }
.meta { display: flex; justify-content: space-between; font-weight: bold; }
section h3 {
  display: flex; justify-content: space-between;
  font-size: calc(var(--paper-size) + 0.5pt); margin: 14px 0 4px; border-bottom: 1px solid #000;
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
.subm { float: right; }
table.match { border-collapse: collapse; width: 90%; margin: 4px 0 4px 18px; }
table.match th, table.match td { border: 1px solid #000; padding: 3px 6px; text-align: left; }

.q-figure-box { margin: 4px 0 6px; break-inside: avoid; }
.q-figure-box.align-center { text-align: center; }
.q-figure-box.align-left { text-align: left; }
.q-figure-box img { max-width: 100%; max-height: 90mm; object-fit: contain; display: inline-block; }
.q-figure-caption { font-size: 9pt; font-style: italic; margin-top: 2px; }
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

function renderFigureHtml(fig) {
  if (!fig || !fig.src) return '';
  const align = fig.align === 'left' ? 'align-left' : 'align-center';
  const widthPct = fig.widthPct || 50;
  const captionHtml = fig.caption ? `<div class='q-figure-caption'>${escapeHtml(fig.caption)}</div>` : '';
  return `
  <div class='q-figure-box ${align}' style='break-inside: avoid;'>
    <img src='${fig.src}' alt='${escapeHtml(fig.caption || 'Figure')}' style='width: ${widthPct}%;' />
    ${captionHtml}
  </div>`;
}

function renderPartial(row) {
  const { no, q } = row;
  const qtype = q.type || 'unknown';
  const figureHtml = renderFigureHtml(q.figure);

  if (qtype === 'mcq') {
    const validOpts = (q.options || []).filter(o => o && String(o).trim());
    const opts = validOpts.map((o, idx) => {
      const letter = 'ABCDEFGH'[idx] || '';
      return `<span>${letter}) ${escapeHtml(o)}</span>`;
    }).join('\n    ');
    return `<div class='q'>
  <p><b>${no}.</b> ${escapeHtml(q.text)}</p>${figureHtml}
  <div class='opts-grid'>
    ${opts}
  </div>
</div>`;
  }

  if (qtype === 'sequence') {
    const roman = ['i', 'ii', 'iii', 'iv', 'v', 'vi'];
    const validItems = (q.items || []).filter(it => it && String(it).trim());
    const items = validItems.map((it, idx) => {
      return `<p>(${roman[idx] || idx + 1}) ${escapeHtml(it)}</p>`;
    }).join('\n    ');

    const validOpts = (q.options || []).filter(o => o && String(o).trim());
    const opts = validOpts.map((o, idx) => {
      const letter = 'ABCDEFGH'[idx] || '';
      return `<span>${letter}. ${escapeHtml(o)}</span>`;
    }).join('\n    ');

    return `<div class='q'>
  <p><b>${no}.</b> ${escapeHtml(q.text)}</p>${figureHtml}
  <div class='seq-items'>
    ${items}
  </div>
  <div class='opts-grid'>
    ${opts}
  </div>
</div>`;
  }

  if (qtype === 'assertion_reason') {
    const validOpts = (q.options || []).filter(o => o && String(o).trim());
    const opts = validOpts.map((o, idx) => {
      const letter = 'ABCD'[idx] || '';
      return `<p>${letter}) ${escapeHtml(o)}</p>`;
    }).join('\n    ');
    // Position rule: below Reason line, above options
    return `<div class='q'>
  <p><b>${no}.</b> Assertion (A): ${escapeHtml(q.assertion)}</p>
  <p class='reason'>Reason (R): ${escapeHtml(q.reason)}</p>${figureHtml}
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
    let rowNum = 0;

    for (let i = 0; i < Math.max(colA.length, colB.length); i++) {
      const a = colA[i] || '';
      const b = colB[i] || '';
      if ((a && String(a).trim()) || (b && String(b).trim())) {
        rowNum++;
        rowsHtml += `
    <tr>
      <td>${rowNum}. ${escapeHtml(a)}</td>
      <td>(${abcd[rowNum - 1] || ''}) ${escapeHtml(b)}</td>
    </tr>`;
      }
    }

    const validOpts = (q.options || []).filter(o => o && String(o).trim());
    const opts = validOpts.map((o, idx) => {
      const letter = 'ABCD'[idx] || '';
      return `<span>${letter}. ${escapeHtml(o)}</span>`;
    }).join('\n    ');

    return `<div class='q'>
  <p><b>${no}.</b> ${escapeHtml(q.text || 'Match the following')}</p>${figureHtml}
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
  <p><b>${no}.</b> ${escapeHtml(q.text)}</p>${figureHtml}
</div>`;
  }

  if (qtype === 'passage') {
    const validSub = (q.subQuestions || []).filter(sq => sq.text && String(sq.text).trim());
    const subHtml = validSub.map((sq, idx) => {
      return `<p class='sub'>${idx + 1}. ${escapeHtml(sq.text)} <span class='subm'>(${sq.marks ?? 1})</span></p>`;
    }).join('\n  ');
    // Position rule: below passage text, above sub-questions
    return `<div class='q'>
  <p><b>${no}.</b> Read the following paragraph and answer the questions given below</p>
  <p class='passage'>${escapeHtml(q.passage)}</p>${figureHtml}
  ${subHtml}
</div>`;
  }

  if (qtype === 'map') {
    const validPlaces = (q.places || []).filter(p => p && String(p).trim());
    const places = validPlaces.map((p, idx) => {
      return `<span>${idx + 1}. ${escapeHtml(p)}</span>`;
    }).join('\n    ');
    return `<div class='q'>
  <p><b>${no}.</b> ${escapeHtml(q.text || 'Locate the following places in an Outline map of India')}</p>${figureHtml}
  <div class='opts-grid'>
    ${places}
  </div>
</div>`;
  }

  return `<div class='q unknown'><b>${no}.</b> Unsupported question type [${escapeHtml(qtype)}]${figureHtml}</div>`;
}

export function renderClientHtml(paper) {
  let number = 0;
  let sectionsHtml = '';

  const style = paper.style || {};
  const fontName = style.fontFamily || 'Times New Roman';
  const fontSize = style.fontSize !== undefined ? Number(style.fontSize) : 11;
  const fontStack = FONT_STACKS[fontName] || FONT_STACKS['Times New Roman'];

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
  <style>
    :root {
      --paper-font: ${fontStack};
      --paper-size: ${fontSize}pt;
    }
    ${BASE_CSS}
  </style>
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
