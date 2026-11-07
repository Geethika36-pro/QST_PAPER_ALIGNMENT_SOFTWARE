/**
 * Interactive Maths & Geometry Diagram Drawer Component
 * Allows teachers to draw geometric shapes, coordinate axes, angles, freehand sketches,
 * and math labels directly in the browser and embed them as PNG figures in questions.
 */

const MATH_CHIPS = ['A', 'B', 'C', 'D', 'O', 'x', 'y', 'r', 'h', 'θ', 'π', 'α', 'β', '90°', '60°', '45°', '30°', '△', '∠', '⊥', 'cm', 'm'];

export class DiagramDrawer {
  constructor() {
    this.modalEl = null;
    this.canvas = null;
    this.ctx = null;
    this.activeTool = 'line';
    this.strokeColor = '#000000';
    this.lineWidth = 2;
    this.eraserSize = 20;
    this.isDashed = false;
    this.showGrid = true;
    this.includeGridInExport = false;

    // Drawing state
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.history = []; // snapshots for undo
    this.maxHistory = 20;

    // Freehand points buffer
    this.freehandPoints = [];

    // Pending text placement
    this.textPos = null;

    // Clipboard paste handler
    this.pasteHandler = null;
  }

  /**
   * Opens the diagram drawing dialog
   * @param {Object} options
   * @param {string} [options.initialImageSrc] Optional existing PNG data URL to edit
   * @param {function(string)} options.onSave Callback with final PNG data URL
   */
  open({ initialImageSrc = null, onSave }) {
    this.close();
    this.onSaveCallback = onSave;
    this.history = [];

    const overlay = document.createElement('div');
    overlay.className = 'diagram-drawer-backdrop';
    overlay.id = 'diagram-drawer-modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      padding: 12px;
      box-sizing: border-box;
    `;

    const chipsHtml = MATH_CHIPS.map(c => `
      <button type="button" class="diagram-chip-btn" data-char="${c}">${c}</button>
    `).join('');

    overlay.innerHTML = `
      <div class="diagram-drawer-window" style="background: #ffffff; border-radius: 8px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); border: 1px solid #cbd5e1; width: 100%; max-width: 840px; max-height: calc(100vh - 24px); display: flex; flex-direction: column; overflow: hidden;">
        <div class="diagram-drawer-header" style="flex-shrink: 0; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; background: #f8fafc;">
          <div class="diagram-header-title" style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">📐</span>
            <div>
              <strong style="font-size: 14px;">Maths Diagram &amp; Geometry Drawer</strong>
              <div class="diagram-header-sub" style="font-size: 11px; color: var(--color-text-muted);">Sketch geometric figures, coordinate axes, angles, math labels, or erase/edit images</div>
            </div>
          </div>
          <button type="button" class="modal-close-btn" id="btn-close-drawer" aria-label="Close" style="font-size: 20px; cursor: pointer; border: none; background: none; color: #64748b;">&times;</button>
        </div>

        <div class="diagram-toolbar" style="flex-shrink: 0; padding: 8px 12px; background: #ffffff; border-bottom: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
          <!-- Tools Group -->
          <div class="tool-group" style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
            <span class="tool-group-label" style="font-size: 11px; font-weight: 600; color: #64748b;">Tools:</span>
            <button type="button" class="btn-dtool active" data-tool="line" title="Straight Line">📏 Line</button>
            <button type="button" class="btn-dtool" data-tool="arrow" title="Arrow / Ray">↗ Arrow</button>
            <button type="button" class="btn-dtool" data-tool="axes" title="Coordinate Axes (X-Y plane with arrows & origin)">📈 X-Y Axes</button>
            <button type="button" class="btn-dtool" data-tool="right_triangle" title="Right-angled Triangle">📐 Right △</button>
            <button type="button" class="btn-dtool" data-tool="triangle" title="General Triangle">△ Triangle</button>
            <button type="button" class="btn-dtool" data-tool="circle" title="Circle / Ellipse">⭕ Circle</button>
            <button type="button" class="btn-dtool" data-tool="rect" title="Rectangle / Square">▭ Rectangle</button>
            <button type="button" class="btn-dtool" data-tool="arc" title="Angle Arc">⌒ Arc</button>
            <button type="button" class="btn-dtool" data-tool="pen" title="Freehand Pen / Curve">✏️ Pen</button>
            <button type="button" class="btn-dtool" data-tool="text" title="Click on canvas to place text/labels">🏷️ Text</button>
            <button type="button" class="btn-dtool btn-dtool-erase" data-tool="eraser" title="Erase strokes or parts of image (drag brush to erase)">🧽 Eraser</button>
            <button type="button" class="btn-dtool btn-dtool-erase" data-tool="erase_box" title="Erase specific image or area (drag rectangle to remove)">✂️ Erase Area</button>
          </div>

          <!-- Styling Controls Group -->
          <div class="tool-group" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-left: auto;">
            <div id="draw-style-controls" style="display: flex; align-items: center; gap: 6px;">
              <span class="tool-group-label" style="font-size: 11px; font-weight: 600; color: #64748b;">Style:</span>
              <select id="select-dcolor" class="form-control form-control-sm" style="width: auto; height: 28px; padding: 2px 6px; font-size: 12px;" title="Stroke Color">
                <option value="#000000">Black</option>
                <option value="#0044cc">Blue</option>
                <option value="#cc0000">Red</option>
                <option value="#008800">Green</option>
                <option value="#555555">Grey</option>
              </select>

              <select id="select-dwidth" class="form-control form-control-sm" style="width: auto; height: 28px; padding: 2px 6px; font-size: 12px;" title="Line Thickness">
                <option value="1.5">Fine (1.5px)</option>
                <option value="2.5" selected>Medium (2.5px)</option>
                <option value="4">Bold (4.0px)</option>
              </select>

              <label class="diagram-checkbox-label" style="font-size: 12px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" title="Dashed style for construction lines, heights, medians">
                <input type="checkbox" id="chk-dashed" /> Dashed
              </label>
            </div>

            <div id="erase-style-controls" style="display: none; align-items: center; gap: 6px;">
              <span class="tool-group-label" style="font-size: 11px; font-weight: 600; color: #dc2626;">Eraser:</span>
              <select id="select-eraser-size" class="form-control form-control-sm" style="width: auto; height: 28px; padding: 2px 6px; font-size: 12px;" title="Eraser Brush Size">
                <option value="10">Fine (10px)</option>
                <option value="20" selected>Medium (20px)</option>
                <option value="35">Large (35px)</option>
                <option value="50">X-Large (50px)</option>
              </select>
              <span id="erase-box-hint" style="display: none; font-size: 11px; color: #dc2626; font-weight: 500;">Drag rectangle over area/image to erase</span>
            </div>

            <label class="diagram-checkbox-label" style="font-size: 12px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" title="Show light background guide grid">
              <input type="checkbox" id="chk-show-grid" checked /> Grid
            </label>

            <div class="toolbar-divider" style="height: 20px; width: 1px; background: #cbd5e1; margin: 0 2px;"></div>

            <button type="button" id="btn-dundo" class="btn btn-secondary btn-sm" style="height: 28px; padding: 2px 8px; font-size: 12px;" title="Undo last action">↶ Undo</button>
            <button type="button" id="btn-dimport-img" class="btn btn-secondary btn-sm" style="height: 28px; padding: 2px 8px; font-size: 12px;" title="Insert or paste an image onto the canvas">🖼️ Insert Image</button>
            <input type="file" id="input-dimport-file" accept="image/png,image/jpeg" style="display: none;" />
            <button type="button" id="btn-dclear" class="btn btn-secondary btn-sm" style="height: 28px; padding: 2px 8px; font-size: 12px;" title="Clear entire canvas">🗑️ Clear All</button>
          </div>
        </div>

        <!-- Canvas Workspace Area -->
        <div class="diagram-canvas-area" id="diagram-canvas-container" style="flex: 1 1 auto; min-height: 0; overflow: auto; display: flex; align-items: center; justify-content: center; background: #f1f5f9; padding: 6px; position: relative;">
          <canvas id="diagram-main-canvas" width="600" height="230" style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: crosshair;"></canvas>

          <!-- Floating Text Entry Box (Shown on Text tool click) -->
          <div id="diagram-text-popover" class="diagram-text-popover" style="display: none; position: absolute; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2); padding: 8px 10px; z-index: 100000; width: 260px;">
            <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px; color: var(--color-text-muted);">
              Type Label or Click Math Symbol:
            </div>
            <div class="diagram-chips-row">
              ${chipsHtml}
            </div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <input type="text" id="diagram-text-input" class="form-control form-control-sm" placeholder="e.g. A, 90°, 5 cm" />
              <button type="button" id="btn-apply-text" class="btn btn-primary btn-sm">Place</button>
              <button type="button" id="btn-cancel-text" class="btn btn-secondary btn-sm">✕</button>
            </div>
          </div>
        </div>

        <div class="diagram-drawer-footer" style="flex-shrink: 0; padding: 10px 16px; border-top: 1px solid #e2e8f0; background: #f8fafc; display: flex; align-items: center; justify-content: space-between;">
          <div style="font-size: 12px; color: var(--color-text-muted);">
            💡 <strong>Tip:</strong> Drag to draw shapes or coordinates. Use <strong>🧽 Eraser</strong> or <strong>✂️ Erase Area</strong> to remove strokes or specific images.
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" id="btn-cancel-drawer" class="btn btn-secondary" style="cursor: pointer;">Cancel</button>
            <button type="button" id="btn-insert-diagram" class="btn btn-primary" style="cursor: pointer; font-weight: 600;">✓ Insert Diagram into Question</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.modalEl = overlay;

    this.canvas = overlay.querySelector('#diagram-main-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.bindDrawerEvents();
    this.initCanvas(initialImageSrc);
  }

  initCanvas(initialImageSrc) {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (initialImageSrc) {
      this.drawImageOnCanvas(initialImageSrc);
    } else {
      this.saveState();
      this.redrawCanvas();
    }
  }

  drawImageOnCanvas(src) {
    const img = new Image();
    img.onload = () => {
      // Draw centered
      const scale = Math.min(this.canvas.width / img.width, this.canvas.height / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (this.canvas.width - w) / 2;
      const y = (this.canvas.height - h) / 2;
      this.ctx.drawImage(img, x, y, w, h);
      this.saveState();
      this.redrawCanvas();
    };
    img.src = src;
  }

  saveState() {
    if (this.history.length >= this.maxHistory) {
      this.history.shift();
    }
    const snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.history.push(snapshot);
  }

  undo() {
    if (this.history.length > 1) {
      this.history.pop(); // Remove current
      const prev = this.history[this.history.length - 1];
      this.ctx.putImageData(prev, 0, 0);
      this.redrawCanvas();
    }
  }

  clearCanvas() {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.saveState();
    this.redrawCanvas();
  }

  bindDrawerEvents() {
    const overlay = this.modalEl;
    if (!overlay) return;

    // Close / Cancel
    const btnClose = overlay.querySelector('#btn-close-drawer');
    if (btnClose) btnClose.addEventListener('click', () => this.close());
    const btnCancel = overlay.querySelector('#btn-cancel-drawer');
    if (btnCancel) btnCancel.addEventListener('click', () => this.close());

    // Tools switching
    overlay.querySelectorAll('.btn-dtool').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.btn-dtool').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTool = btn.dataset.tool;
        this.hideTextPopover();
        this.updateCanvasCursor();
        this.updateToolbarStyleMode();
      });
    });

    // Style inputs
    const selColor = overlay.querySelector('#select-dcolor');
    if (selColor) selColor.addEventListener('change', (e) => { this.strokeColor = e.target.value; });

    const selWidth = overlay.querySelector('#select-dwidth');
    if (selWidth) selWidth.addEventListener('change', (e) => { this.lineWidth = Number(e.target.value); });

    const selEraserSize = overlay.querySelector('#select-eraser-size');
    if (selEraserSize) {
      selEraserSize.addEventListener('change', (e) => {
        this.eraserSize = Number(e.target.value);
      });
    }

    const chkDashed = overlay.querySelector('#chk-dashed');
    if (chkDashed) chkDashed.addEventListener('change', (e) => { this.isDashed = e.target.checked; });

    const chkGrid = overlay.querySelector('#chk-show-grid');
    if (chkGrid) {
      chkGrid.addEventListener('change', (e) => {
        this.showGrid = e.target.checked;
        this.redrawCanvas();
      });
    }

    const chkExpGrid = overlay.querySelector('#chk-export-grid');
    if (chkExpGrid) {
      chkExpGrid.addEventListener('change', (e) => {
        this.includeGridInExport = e.target.checked;
      });
    }

    // Undo / Clear
    const btnUndo = overlay.querySelector('#btn-dundo');
    if (btnUndo) btnUndo.addEventListener('click', () => this.undo());
    const btnClear = overlay.querySelector('#btn-dclear');
    if (btnClear) btnClear.addEventListener('click', () => this.clearCanvas());

    // Import Image button and file input
    const btnImportImg = overlay.querySelector('#btn-dimport-img');
    const inputImportFile = overlay.querySelector('#input-dimport-file');
    if (btnImportImg && inputImportFile) {
      btnImportImg.addEventListener('click', () => inputImportFile.click());
      inputImportFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            this.drawImageOnCanvas(evt.target.result);
          };
          reader.readAsDataURL(file);
        }
        inputImportFile.value = '';
      });
    }

    // Clipboard Paste Listener (Ctrl+V into canvas)
    this.pasteHandler = (e) => {
      if (!this.modalEl) return;
      const items = (e.clipboardData || window.clipboardData)?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (evt) => {
            this.drawImageOnCanvas(evt.target.result);
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };
    window.addEventListener('paste', this.pasteHandler);

    // Text popover controls
    const textPopover = overlay.querySelector('#diagram-text-popover');
    const textInput = overlay.querySelector('#diagram-text-input');
    const btnApplyText = overlay.querySelector('#btn-apply-text');
    const btnCancelText = overlay.querySelector('#btn-cancel-text');

    overlay.querySelectorAll('.diagram-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (textInput) {
          textInput.value += btn.dataset.char;
          textInput.focus();
        }
      });
    });

    if (btnApplyText) btnApplyText.addEventListener('click', () => this.applyText());
    if (textInput) {
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.applyText();
        if (e.key === 'Escape') this.hideTextPopover();
      });
    }
    if (btnCancelText) btnCancelText.addEventListener('click', () => this.hideTextPopover());

    // Insert Diagram into Question
    const btnInsert = overlay.querySelector('#btn-insert-diagram');
    if (btnInsert) {
      btnInsert.addEventListener('click', () => {
        const dataUrl = this.exportToPng();
        if (this.onSaveCallback) {
          this.onSaveCallback(dataUrl);
        }
        this.close();
      });
    }

    // Canvas Pointer Events
    if (this.canvas) {
      this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
      this.canvas.addEventListener('mousemove', (e) => this.onPointerMove(e));
      window.addEventListener('mouseup', (e) => this.onPointerUp(e));
    }
  }

  updateCanvasCursor() {
    if (!this.canvas) return;
    if (this.activeTool === 'eraser') {
      this.canvas.style.cursor = 'cell';
    } else if (this.activeTool === 'erase_box') {
      this.canvas.style.cursor = 'crosshair';
    } else if (this.activeTool === 'text') {
      this.canvas.style.cursor = 'text';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }
  }

  updateToolbarStyleMode() {
    const overlay = this.modalEl;
    if (!overlay) return;
    const drawStyles = overlay.querySelector('#draw-style-controls');
    const eraseStyles = overlay.querySelector('#erase-style-controls');
    const eraseHint = overlay.querySelector('#erase-box-hint');
    const selectEraserSize = overlay.querySelector('#select-eraser-size');

    if (this.activeTool === 'eraser') {
      if (drawStyles) drawStyles.style.display = 'none';
      if (eraseStyles) eraseStyles.style.display = 'flex';
      if (selectEraserSize) selectEraserSize.style.display = 'inline-block';
      if (eraseHint) eraseHint.style.display = 'none';
    } else if (this.activeTool === 'erase_box') {
      if (drawStyles) drawStyles.style.display = 'none';
      if (eraseStyles) eraseStyles.style.display = 'flex';
      if (selectEraserSize) selectEraserSize.style.display = 'none';
      if (eraseHint) eraseHint.style.display = 'inline-block';
    } else {
      if (drawStyles) drawStyles.style.display = 'flex';
      if (eraseStyles) eraseStyles.style.display = 'none';
    }
  }

  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  onPointerDown(e) {
    const coords = this.getCanvasCoords(e);

    if (this.activeTool === 'text') {
      this.showTextPopover(coords, e.clientX, e.clientY);
      return;
    }

    this.isDrawing = true;
    this.startX = coords.x;
    this.startY = coords.y;

    if (this.activeTool === 'pen') {
      this.freehandPoints = [coords];
    } else if (this.activeTool === 'eraser') {
      this.freehandPoints = [coords];
      this.eraseAtPoint(coords.x, coords.y);
    }
  }

  onPointerMove(e) {
    if (!this.isDrawing) return;
    const coords = this.getCanvasCoords(e);

    if (this.activeTool === 'pen') {
      this.freehandPoints.push(coords);
      this.drawFreehandSegment();
      return;
    }

    if (this.activeTool === 'eraser') {
      this.freehandPoints.push(coords);
      this.eraseFreehandSegment();
      return;
    }

    if (this.activeTool === 'erase_box') {
      this.restoreSnapshot();
      this.drawEraseBoxPreview(this.startX, this.startY, coords.x, coords.y);
      return;
    }

    // Restore clean snapshot and draw live shape preview
    this.restoreSnapshot();
    this.drawShapePreview(this.startX, this.startY, coords.x, coords.y);
  }

  onPointerUp(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const coords = this.getCanvasCoords(e);

    if (this.activeTool === 'pen') {
      this.saveState();
      this.redrawCanvas();
      this.freehandPoints = [];
      return;
    }

    if (this.activeTool === 'eraser') {
      this.saveState();
      this.redrawCanvas();
      this.freehandPoints = [];
      return;
    }

    if (this.activeTool === 'erase_box') {
      this.restoreSnapshot();
      const rx = Math.min(this.startX, coords.x);
      const ry = Math.min(this.startY, coords.y);
      const rw = Math.abs(coords.x - this.startX);
      const rh = Math.abs(coords.y - this.startY);
      if (rw > 3 && rh > 3) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(rx, ry, rw, rh);
        this.saveState();
        this.redrawCanvas();
      }
      return;
    }

    // Finalize shape
    this.restoreSnapshot();
    this.drawFinalShape(this.startX, this.startY, coords.x, coords.y);
    this.saveState();
    this.redrawCanvas();
  }

  eraseAtPoint(x, y) {
    this.ctx.save();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.eraserSize / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  eraseFreehandSegment() {
    const pts = this.freehandPoints;
    if (pts.length < 2) return;
    this.ctx.save();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = this.eraserSize;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();
    const p1 = pts[pts.length - 2];
    const p2 = pts[pts.length - 1];
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawEraseBoxPreview(x1, y1, x2, y2) {
    this.ctx.save();
    const rx = Math.min(x1, x2);
    const ry = Math.min(y1, y2);
    const rw = Math.abs(x2 - x1);
    const rh = Math.abs(y2 - y1);

    // Red tint overlay indicating region to be erased
    this.ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    this.ctx.fillRect(rx, ry, rw, rh);

    this.ctx.strokeStyle = '#dc2626';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([5, 4]);
    this.ctx.strokeRect(rx, ry, rw, rh);

    // Small badge label if box is large enough
    if (rw > 70 && rh > 26) {
      this.ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
      this.ctx.fillRect(rx + 4, ry + 4, 82, 18);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 10px sans-serif';
      this.ctx.fillText('✂️ Erase Area', rx + 8, ry + 16);
    }
    this.ctx.restore();
  }

  restoreSnapshot() {
    if (this.history.length > 0) {
      const current = this.history[this.history.length - 1];
      this.ctx.putImageData(current, 0, 0);
    }
  }

  drawFreehandSegment() {
    const pts = this.freehandPoints;
    if (pts.length < 2) return;
    this.ctx.save();
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = this.lineWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    if (this.isDashed) this.ctx.setLineDash([6, 4]);

    this.ctx.beginPath();
    const p1 = pts[pts.length - 2];
    const p2 = pts[pts.length - 1];
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  setupStyle() {
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.fillStyle = this.strokeColor;
    this.ctx.lineWidth = this.lineWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    if (this.isDashed) {
      this.ctx.setLineDash([6, 4]);
    } else {
      this.ctx.setLineDash([]);
    }
  }

  drawShapePreview(x1, y1, x2, y2) {
    this.ctx.save();
    this.setupStyle();
    this.renderShape(this.activeTool, x1, y1, x2, y2);
    this.ctx.restore();
  }

  drawFinalShape(x1, y1, x2, y2) {
    this.ctx.save();
    this.setupStyle();
    this.renderShape(this.activeTool, x1, y1, x2, y2);
    this.ctx.restore();
  }

  renderShape(tool, x1, y1, x2, y2) {
    const ctx = this.ctx;

    if (tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (tool === 'arrow') {
      this.drawArrow(x1, y1, x2, y2);
    } else if (tool === 'axes') {
      this.drawCoordinateAxes(x1, y1, x2, y2);
    } else if (tool === 'right_triangle') {
      this.drawRightTriangle(x1, y1, x2, y2);
    } else if (tool === 'triangle') {
      this.drawTriangle(x1, y1, x2, y2);
    } else if (tool === 'circle') {
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.abs(y2 - y1) / 2;
      const cx = Math.min(x1, x2) + rx;
      const cy = Math.min(y1, y2) + ry;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tool === 'rect') {
      ctx.beginPath();
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    } else if (tool === 'arc') {
      this.drawAngleArc(x1, y1, x2, y2);
    }
  }

  drawArrow(x1, y1, x2, y2) {
    const ctx = this.ctx;
    const headLen = 10 + this.lineWidth * 1.5;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawCoordinateAxes(x1, y1, x2, y2) {
    const ctx = this.ctx;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);

    // X Axis
    this.drawArrow(left, cy, right, cy);
    this.drawArrow(right, cy, left, cy);

    // Y Axis
    this.drawArrow(cx, bottom, cx, top);
    this.drawArrow(cx, top, cx, bottom);

    // Labels
    ctx.save();
    ctx.setLineDash([]);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('X', right + 4, cy + 4);
    ctx.fillText("X'", left - 16, cy + 4);
    ctx.fillText('Y', cx - 4, top - 6);
    ctx.fillText("Y'", cx - 4, bottom + 16);
    ctx.fillText('O', cx + 4, cy + 14);
    ctx.restore();
  }

  drawRightTriangle(x1, y1, x2, y2) {
    const ctx = this.ctx;
    // Right angle at (x1, y2)
    const rx = x1;
    const ry = y2;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(rx, ry);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.stroke();

    // Draw right-angle square marker
    const sqSize = 12;
    const dirX = x2 > x1 ? 1 : -1;
    const dirY = y1 > y2 ? 1 : -1;

    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(rx, ry - sqSize * dirY);
    ctx.lineTo(rx + sqSize * dirX, ry - sqSize * dirY);
    ctx.lineTo(rx + sqSize * dirX, ry);
    ctx.stroke();
    ctx.restore();
  }

  drawTriangle(x1, y1, x2, y2) {
    const ctx = this.ctx;
    const topX = (x1 + x2) / 2;
    const topY = Math.min(y1, y2);
    const bY = Math.max(y1, y2);

    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(x1, bY);
    ctx.lineTo(x2, bY);
    ctx.closePath();
    ctx.stroke();
  }

  drawAngleArc(x1, y1, x2, y2) {
    const ctx = this.ctx;
    const radius = Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1), 35);
    const startAngle = 0;
    const endAngle = Math.PI / 2;

    ctx.beginPath();
    ctx.arc(x1, y1, radius, startAngle, endAngle);
    ctx.stroke();
  }

  showTextPopover(coords, clientX, clientY) {
    const popover = this.modalEl.querySelector('#diagram-text-popover');
    const input = this.modalEl.querySelector('#diagram-text-input');
    const rect = this.canvas.getBoundingClientRect();

    this.textPos = coords;
    popover.style.display = 'block';

    const popX = Math.max(10, Math.min(rect.width - 260, clientX - rect.left));
    const popY = Math.max(10, Math.min(rect.height - 130, clientY - rect.top));

    popover.style.left = `${popX}px`;
    popover.style.top = `${popY}px`;

    input.value = '';
    input.focus();
  }

  hideTextPopover() {
    const popover = this.modalEl?.querySelector('#diagram-text-popover');
    if (popover) popover.style.display = 'none';
    this.textPos = null;
  }

  applyText() {
    const input = this.modalEl.querySelector('#diagram-text-input');
    const text = input.value.trim();

    if (text && this.textPos) {
      this.ctx.save();
      this.ctx.fillStyle = this.strokeColor;
      this.ctx.font = 'bold 15px sans-serif';
      this.ctx.fillText(text, this.textPos.x, this.textPos.y);
      this.ctx.restore();

      this.saveState();
      this.redrawCanvas();
    }

    this.hideTextPopover();
  }

  redrawCanvas() {
    // Canvas container handles background grid via CSS class when showGrid is enabled
    const container = this.modalEl?.querySelector('#diagram-canvas-container');
    if (container) {
      if (this.showGrid) {
        container.classList.add('grid-guide-active');
      } else {
        container.classList.remove('grid-guide-active');
      }
    }
  }

  exportToPng() {
    // Create an offscreen export canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.canvas.width;
    exportCanvas.height = this.canvas.height;
    const expCtx = exportCanvas.getContext('2d');

    // Fill white background
    expCtx.fillStyle = '#ffffff';
    expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // If teacher selected "Include grid in export", draw fine light grid
    if (this.includeGridInExport) {
      expCtx.strokeStyle = '#e2e8f0';
      expCtx.lineWidth = 1;
      const step = 20;
      expCtx.beginPath();
      for (let x = 0; x <= exportCanvas.width; x += step) {
        expCtx.moveTo(x, 0);
        expCtx.lineTo(x, exportCanvas.height);
      }
      for (let y = 0; y <= exportCanvas.height; y += step) {
        expCtx.moveTo(0, y);
        expCtx.lineTo(exportCanvas.width, y);
      }
      expCtx.stroke();
    }

    // Draw main canvas content over white background
    expCtx.drawImage(this.canvas, 0, 0);

    return exportCanvas.toDataURL('image/png');
  }

  close() {
    if (this.pasteHandler) {
      window.removeEventListener('paste', this.pasteHandler);
      this.pasteHandler = null;
    }
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
      this.canvas = null;
      this.ctx = null;
    }
  }
}

