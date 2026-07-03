// Level editor: DOM sidebar + canvas painting on the shared #game canvas.
//
// Contract (called from src/main.js):
//   export function initEditor(app) -> { open(rows?), close(), render(ctx, t) }
//
// While app.mode === 'editor' the main loop calls render(ctx, t) each frame
// on the 640x360 game canvas. All other UI (palette, textarea, buttons) is
// built as DOM and lives in a floating panel appended to #frame (or <body>).

import { GRID_CHARS, ACTOR_CHARS } from '../game/level.js';
import { PALETTE } from '../render/palette.js';

const TILE = 16;
const VIEW_W = 640;
const VIEW_H = 360;

// Char -> { label, color } for the palette buttons + canvas tile fill.
const CHAR_INFO = {
  ' ': { label: 'Eraser', color: '#00000000', swatch: '#1a1626' },
  x: { label: 'Wall', color: PALETTE.wall },
  '#': { label: 'BG Wall', color: PALETTE.bgWall },
  '!': { label: 'Lava', color: PALETTE.lava },
  '-': { label: 'One-way', color: PALETTE.oneway },
  D: { label: 'Door', color: PALETTE.door },
  '@': { label: 'Player', color: PALETTE.playerBody },
  o: { label: 'Coin', color: PALETTE.coin },
  v: { label: 'Lava drip', color: PALETTE.lava },
  '|': { label: 'Lava (V)', color: PALETTE.lavaDeep },
  '=': { label: 'Lava (H)', color: PALETTE.lavaBright },
  '~': { label: 'Platform (H)', color: PALETTE.wallRimBright },
  H: { label: 'Platform (V)', color: PALETTE.wallRim },
  '^': { label: 'Spring', color: PALETTE.spring },
  k: { label: 'Key', color: PALETTE.key },
  e: { label: 'Enemy', color: PALETTE.enemy },
  '*': { label: 'Checkpoint', color: PALETTE.checkpoint },
  E: { label: 'Exit', color: PALETTE.portal },
};

const PALETTE_ORDER = [' ', 'x', '#', '!', '-', 'D', '@', 'E', 'o', 'k', '^', '*', 'e', 'v', '|', '=', '~', 'H'];

function makeBlankTemplate(w, h) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    if (y === h - 1) {
      rows.push('x'.repeat(w));
    } else {
      let row = '#'.repeat(0) + ' '.repeat(w);
      row = row.split('');
      row[0] = 'x';
      row[w - 1] = 'x';
      rows.push(row.join(''));
    }
  }
  // Player near bottom-left, exit near bottom-right, one row above the floor.
  const actorY = h - 2;
  if (actorY >= 0) {
    const px = 2;
    const ex = w - 3;
    rows[actorY] = setChar(rows[actorY], px, '@');
    rows[actorY] = setChar(rows[actorY], ex, 'E');
  }
  return rows;
}

function setChar(row, x, ch) {
  if (x < 0 || x >= row.length) return row;
  return row.slice(0, x) + ch + row.slice(x + 1);
}

function padRows(rows) {
  const w = Math.max(1, ...rows.map((r) => r.length));
  return rows.map((r) => (r.length < w ? r + ' '.repeat(w - r.length) : r));
}

function ensureSingleAt(rows) {
  // Keep exactly one '@' — keep the first occurrence found (row-major).
  let found = false;
  const out = [];
  for (const row of rows) {
    let newRow = '';
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '@') {
        if (found) {
          newRow += ' ';
        } else {
          found = true;
          newRow += '@';
        }
      } else {
        newRow += ch;
      }
    }
    out.push(newRow);
  }
  return out;
}

export function initEditor(app) {
  // --- Module/instance state ------------------------------------------------
  let rows = padRows(makeBlankTemplate(40, 22));
  let levelName = 'Untitled';
  let selectedChar = 'x';
  let camX = 0;
  let camY = 0;
  let hoverTx = -1;
  let hoverTy = -1;
  let isOpen = false;
  let isPainting = false;
  let paintButton = -1; // 0 = left(paint), 2 = right(erase)
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let panStartCamX = 0;
  let panStartCamY = 0;
  let spaceHeld = false;
  const heldKeys = new Set();
  let syncTextareaTimer = null;
  let suppressTextareaSync = false;

  const canvas = document.getElementById('game');

  // --- DOM panel --------------------------------------------------------------

  const style = document.createElement('style');
  style.textContent = `
#editor-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 280px;
  background: #0d0a1a;
  border-left: 2px solid #4ee3b5;
  color: #e8e4f4;
  font-family: 'Courier New', Consolas, monospace;
  font-size: 12px;
  display: none;
  flex-direction: column;
  padding: 10px;
  gap: 8px;
  overflow-y: auto;
  box-sizing: border-box;
  z-index: 50;
}
#editor-panel.open { display: flex; }
#editor-panel h3 {
  margin: 4px 0 2px;
  color: #4ee3b5;
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
}
#editor-panel label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: #8d84ad;
}
#editor-panel input[type="text"],
#editor-panel input[type="number"] {
  background: #1b1430;
  border: 1px solid #3d4258;
  color: #e8e4f4;
  font-family: inherit;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 3px;
}
#editor-panel input:focus {
  outline: none;
  border-color: #4ee3b5;
}
#editor-dims {
  display: flex;
  gap: 6px;
}
#editor-dims label { flex: 1; }
#editor-palette {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.editor-swatch-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: #1b1430;
  border: 1px solid #3d4258;
  color: #e8e4f4;
  font-family: inherit;
  font-size: 10px;
  padding: 4px 2px;
  border-radius: 3px;
  cursor: pointer;
}
.editor-swatch-btn:hover { border-color: #6a7190; }
.editor-swatch-btn.selected {
  border-color: #4ee3b5;
  background: #16302a;
  box-shadow: 0 0 4px #4ee3b588;
}
.editor-swatch-color {
  width: 18px;
  height: 18px;
  border-radius: 2px;
  border: 1px solid #00000055;
}
.editor-swatch-char {
  font-weight: bold;
}
#editor-panel .editor-btn-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
#editor-panel button.editor-action {
  flex: 1;
  background: #1b1430;
  border: 1px solid #4ee3b5;
  color: #4ee3b5;
  font-family: inherit;
  font-size: 12px;
  padding: 6px 4px;
  border-radius: 3px;
  cursor: pointer;
  white-space: nowrap;
}
#editor-panel button.editor-action:hover {
  background: #4ee3b5;
  color: #0d0a1a;
}
#editor-panel button.editor-action.danger {
  border-color: #e05f7c;
  color: #e05f7c;
}
#editor-panel button.editor-action.danger:hover {
  background: #e05f7c;
  color: #0d0a1a;
}
#editor-ascii {
  flex: 1;
  min-height: 140px;
  background: #05040a;
  color: #8ee3c8;
  border: 1px solid #3d4258;
  border-radius: 3px;
  font-family: 'Courier New', Consolas, monospace;
  font-size: 10px;
  line-height: 1.15;
  white-space: pre;
  overflow: auto;
  resize: vertical;
  padding: 4px;
}
#editor-ascii:focus { outline: none; border-color: #4ee3b5; }
#editor-hint {
  color: #6a7190;
  font-size: 10px;
  line-height: 1.4;
}
`;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'editor-panel';
  panel.innerHTML = `
    <h3>WISP Editor</h3>
    <label>Level name
      <input type="text" id="editor-name" value="${levelName}" maxlength="40" />
    </label>
    <div id="editor-dims">
      <label>Width
        <input type="number" id="editor-w" min="8" max="200" value="40" />
      </label>
      <label>Height
        <input type="number" id="editor-h" min="8" max="60" value="22" />
      </label>
    </div>
    <h3>Palette</h3>
    <div id="editor-palette"></div>
    <h3>Actions</h3>
    <div class="editor-btn-row">
      <button class="editor-action" id="editor-play">&#9654; Playtest</button>
      <button class="editor-action" id="editor-new">New</button>
    </div>
    <div class="editor-btn-row">
      <button class="editor-action" id="editor-copy">Copy ASCII</button>
      <button class="editor-action danger" id="editor-close">Close</button>
    </div>
    <h3>ASCII</h3>
    <textarea id="editor-ascii" spellcheck="false"></textarea>
    <div id="editor-hint">
      Left-click/drag: paint &middot; Right-click: erase &middot; Middle-drag or
      Space+drag: pan &middot; Arrow keys: pan
    </div>
  `;

  const hostParent = document.getElementById('frame') || document.body;
  // Ensure the host is a positioning context for the absolutely-positioned panel.
  if (hostParent && getComputedStyle(hostParent).position === 'static') {
    hostParent.style.position = 'relative';
  }
  hostParent.appendChild(panel);

  const nameInput = panel.querySelector('#editor-name');
  const wInput = panel.querySelector('#editor-w');
  const hInput = panel.querySelector('#editor-h');
  const paletteEl = panel.querySelector('#editor-palette');
  const asciiEl = panel.querySelector('#editor-ascii');
  const playBtn = panel.querySelector('#editor-play');
  const newBtn = panel.querySelector('#editor-new');
  const copyBtn = panel.querySelector('#editor-copy');
  const closeBtn = panel.querySelector('#editor-close');

  // Build palette buttons.
  for (const ch of PALETTE_ORDER) {
    const info = CHAR_INFO[ch];
    if (!info) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'editor-swatch-btn';
    btn.dataset.char = ch;
    btn.innerHTML = `
      <span class="editor-swatch-color" style="background:${ch === ' ' ? '#1a1626' : info.color}"></span>
      <span class="editor-swatch-char">${ch === ' ' ? '⌫' : ch}</span>
      <span>${info.label}</span>
    `;
    btn.addEventListener('click', () => {
      selectedChar = ch;
      updatePaletteSelection();
    });
    paletteEl.appendChild(btn);
  }

  function updatePaletteSelection() {
    for (const btn of paletteEl.querySelectorAll('.editor-swatch-btn')) {
      btn.classList.toggle('selected', btn.dataset.char === selectedChar);
    }
  }

  function levelWidth() {
    return Math.max(...rows.map((r) => r.length), 1);
  }
  function levelHeight() {
    return rows.length;
  }

  function syncAsciiFromRows() {
    suppressTextareaSync = true;
    asciiEl.value = rows.join('\n');
    suppressTextareaSync = false;
  }

  function syncDimInputs() {
    wInput.value = levelWidth();
    hInput.value = levelHeight();
  }

  function pushHistorySkip() {
    /* no-op placeholder for future undo support */
  }

  function setRows(newRows, opts = {}) {
    rows = ensureSingleAt(padRows(newRows.length ? newRows : ['']));
    if (!opts.skipAscii) syncAsciiFromRows();
    if (!opts.skipDims) syncDimInputs();
    clampCamera();
  }

  // --- Textarea <-> grid sync ---------------------------------------------

  asciiEl.addEventListener('input', () => {
    if (suppressTextareaSync) return;
    if (syncTextareaTimer) clearTimeout(syncTextareaTimer);
    syncTextareaTimer = setTimeout(() => {
      try {
        const raw = asciiEl.value.replace(/\r\n/g, '\n').split('\n');
        const parsed = raw.length ? raw : [''];
        rows = ensureSingleAt(padRows(parsed));
        syncDimInputs();
        clampCamera();
      } catch (err) {
        // Never throw — leave rows untouched on parse failure.
        console.warn('editor: failed to parse ascii textarea', err);
      }
    }, 300);
  });

  nameInput.addEventListener('input', () => {
    levelName = nameInput.value || 'Untitled';
  });

  function resizeGrid(newW, newH) {
    newW = Math.max(8, Math.min(200, newW | 0));
    newH = Math.max(8, Math.min(60, newH | 0));
    const next = [];
    for (let y = 0; y < newH; y++) {
      const src = rows[y] || '';
      let row = src.slice(0, newW);
      if (row.length < newW) row += ' '.repeat(newW - row.length);
      next.push(row);
    }
    setRows(next, { skipDims: true });
    wInput.value = newW;
    hInput.value = newH;
  }

  wInput.addEventListener('change', () => {
    resizeGrid(parseInt(wInput.value, 10) || levelWidth(), levelHeight());
  });
  hInput.addEventListener('change', () => {
    resizeGrid(levelWidth(), parseInt(hInput.value, 10) || levelHeight());
  });

  // --- Buttons -----------------------------------------------------------

  newBtn.addEventListener('click', () => {
    levelName = 'Untitled';
    nameInput.value = levelName;
    setRows(makeBlankTemplate(40, 22));
    camX = 0;
    camY = 0;
  });

  copyBtn.addEventListener('click', async () => {
    const text = rows.join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: select the textarea content so the user can Ctrl+C.
      asciiEl.focus();
      asciiEl.select();
    }
  });

  playBtn.addEventListener('click', () => {
    app.startCustomLevel(rows.slice(), { fromEditor: true, name: levelName || 'Playtest' });
  });

  closeBtn.addEventListener('click', () => {
    app.closeEditor();
  });

  // --- Canvas painting -----------------------------------------------------

  function clientToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (clientX - rect.left) * scaleX;
    const cy = (clientY - rect.top) * scaleY;
    return { wx: cx + camX, wy: cy + camY };
  }

  function worldToTile(wx, wy) {
    return { tx: Math.floor(wx / TILE), ty: Math.floor(wy / TILE) };
  }

  function paintAt(tx, ty, ch) {
    if (tx < 0 || ty < 0 || ty >= rows.length) return;
    const row = rows[ty];
    if (tx >= row.length) return;
    if (ch === '@') {
      // Erase any existing '@' before placing the new one.
      rows = rows.map((r) => r.replace('@', ' '));
    }
    rows[ty] = setChar(rows[ty], tx, ch);
    syncAsciiFromRows();
  }

  function clampCamera() {
    const w = levelWidth() * TILE;
    const h = levelHeight() * TILE;
    const margin = 64;
    const maxX = Math.max(-margin, w - VIEW_W + margin);
    const maxY = Math.max(-margin, h - VIEW_H + margin);
    camX = Math.max(-margin, Math.min(maxX, camX));
    camY = Math.max(-margin, Math.min(maxY, camY));
  }

  function onMouseDown(e) {
    if (e.button === 1) {
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panStartCamX = camX;
      panStartCamY = camY;
      e.preventDefault();
      return;
    }
    if (spaceHeld && e.button === 0) {
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panStartCamX = camX;
      panStartCamY = camY;
      return;
    }
    if (e.button === 0 || e.button === 2) {
      isPainting = true;
      paintButton = e.button;
      const { wx, wy } = clientToWorld(e.clientX, e.clientY);
      const { tx, ty } = worldToTile(wx, wy);
      paintAt(tx, ty, e.button === 2 ? ' ' : selectedChar);
    }
  }

  function onMouseMove(e) {
    const { wx, wy } = clientToWorld(e.clientX, e.clientY);
    const { tx, ty } = worldToTile(wx, wy);
    hoverTx = tx;
    hoverTy = ty;

    if (isPanning) {
      camX = panStartCamX - (e.clientX - panStartX) * (canvas.width / canvas.getBoundingClientRect().width);
      camY = panStartCamY - (e.clientY - panStartY) * (canvas.height / canvas.getBoundingClientRect().height);
      clampCamera();
      return;
    }
    if (isPainting) {
      paintAt(tx, ty, paintButton === 2 ? ' ' : selectedChar);
    }
  }

  function onMouseUp() {
    isPainting = false;
    isPanning = false;
    paintButton = -1;
  }

  function onContextMenu(e) {
    e.preventDefault();
  }

  function onKeyDown(e) {
    if (e.target === asciiEl || e.target === nameInput || e.target === wInput || e.target === hInput) return;
    if (e.code === 'Space') {
      spaceHeld = true;
      e.preventDefault();
    }
    if (e.key.startsWith('Arrow')) {
      heldKeys.add(e.key);
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    if (e.code === 'Space') spaceHeld = false;
    if (e.key.startsWith('Arrow')) heldKeys.delete(e.key);
  }

  function applyKeyPan(dt) {
    const speed = 400 * dt; // px/sec
    if (heldKeys.has('ArrowLeft')) camX -= speed;
    if (heldKeys.has('ArrowRight')) camX += speed;
    if (heldKeys.has('ArrowUp')) camY -= speed;
    if (heldKeys.has('ArrowDown')) camY += speed;
    if (heldKeys.size) clampCamera();
  }

  let listenersAttached = false;
  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }
  function detachListeners() {
    if (!listenersAttached) return;
    listenersAttached = false;
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    heldKeys.clear();
    spaceHeld = false;
    isPainting = false;
    isPanning = false;
  }

  // --- Rendering -------------------------------------------------------------

  let lastFrameT = 0;

  function render(ctx, t) {
    const dt = lastFrameT ? Math.min(0.05, t - lastFrameT) : 0;
    lastFrameT = t;
    applyKeyPan(dt);

    ctx.fillStyle = PALETTE.skyTop;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const w = levelWidth();
    const h = levelHeight();

    const startTx = Math.max(0, Math.floor(camX / TILE));
    const startTy = Math.max(0, Math.floor(camY / TILE));
    const endTx = Math.min(w, Math.ceil((camX + VIEW_W) / TILE) + 1);
    const endTy = Math.min(h, Math.ceil((camY + VIEW_H) / TILE) + 1);

    for (let ty = startTy; ty < endTy; ty++) {
      const row = rows[ty] || '';
      for (let tx = startTx; tx < endTx; tx++) {
        const ch = row[tx] || ' ';
        if (ch === ' ') continue;
        const info = CHAR_INFO[ch];
        const color = info ? info.color : '#e05f7c';
        const px = tx * TILE - camX;
        const py = ty * TILE - camY;
        ctx.fillStyle = color;
        if (ACTOR_CHARS.has(ch) && !GRID_CHARS.has(ch)) {
          // Draw actors as inset circles/diamonds so they read distinct from tiles.
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = '#00000055';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
        } else {
          ctx.fillRect(px, py, TILE, TILE);
        }
      }
    }

    // Grid lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let tx = startTx; tx <= endTx; tx++) {
      const px = Math.floor(tx * TILE - camX) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, VIEW_H);
    }
    for (let ty = startTy; ty <= endTy; ty++) {
      const py = Math.floor(ty * TILE - camY) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(VIEW_W, py);
    }
    ctx.stroke();

    // Level bounds border.
    ctx.strokeStyle = '#4ee3b5aa';
    ctx.lineWidth = 2;
    ctx.strokeRect(-camX + 1, -camY + 1, w * TILE - 2, h * TILE - 2);

    // Hover highlight.
    if (hoverTx >= 0 && hoverTy >= 0 && hoverTx < w && hoverTy < h) {
      const px = hoverTx * TILE - camX;
      const py = hoverTy * TILE - camY;
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
    }
  }

  // --- Open / close ------------------------------------------------------

  function open(newRows) {
    if (newRows && newRows.length) {
      setRows(newRows);
    } else {
      syncAsciiFromRows();
      syncDimInputs();
    }
    updatePaletteSelection();
    panel.classList.add('open');
    isOpen = true;
    lastFrameT = 0;
    attachListeners();
  }

  function close() {
    panel.classList.remove('open');
    isOpen = false;
    detachListeners();
  }

  updatePaletteSelection();
  syncAsciiFromRows();
  syncDimInputs();

  return { open, close, render };
}
