// Character-grid renderer: the game draws chars into a cols x rows buffer,
// then flush() paints the buffer onto a <canvas> in a monospace font.
// Games register tappable zones while drawing; taps are mapped back to them.

const FONT_STACK = '"Cascadia Mono", "Consolas", "DejaVu Sans Mono", "Menlo", monospace';
const CHAR_ASPECT = 0.6; // monospace glyph width / height

export class Renderer {
  constructor(canvas, cols, rows) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.setGrid(cols, rows);
    window.addEventListener("resize", () => this.resize());
  }

  // Change the grid size (e.g. taller grid on a portrait phone).
  setGrid(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows;
    this.chars = new Array(n).fill(" ");
    this.colors = new Array(n).fill("#fff");
    this.bgs = new Array(n).fill(null); // optional glow box behind a cell
    this.bold = new Uint8Array(n);
    this.fills = new Array(n).fill(null); // solid cell background
    this.zones = [];
    this.lastZones = [];
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const availW = window.innerWidth - 4;
    const availH = window.innerHeight - 4;
    // cell height limited by both axes
    const cellH = Math.max(8, Math.floor(Math.min(availH / this.rows, availW / (this.cols * CHAR_ASPECT))));
    this.cellH = cellH;
    this.cellW = cellH * CHAR_ASPECT;
    const w = Math.round(this.cellW * this.cols);
    const h = cellH * this.rows;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const size = Math.floor(cellH * 0.92);
    this.fontNormal = `${size}px ${FONT_STACK}`;
    this.fontBold = `bold ${Math.floor(cellH * 1.05)}px ${FONT_STACK}`;
    this.ctx.textBaseline = "top";
    this.ctx.textAlign = "center";
  }

  clear() {
    this.chars.fill(" ");
    this.bgs.fill(null);
    this.bold.fill(0);
    this.fills.fill(null);
    this.zones = [];
  }

  // style: { bg: "css colour" for a glow box behind the char, bold: true }
  put(x, y, ch, color, style) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.chars[i] = ch;
    this.colors[i] = color;
    this.bgs[i] = style && style.bg ? style.bg : null;
    this.bold[i] = style && style.bold ? 1 : 0;
  }

  // Draw a string; spaces are transparent (they don't overwrite).
  text(x, y, str, color, style) {
    for (let i = 0; i < str.length; i++) {
      if (str[i] !== " ") this.put(x + i, y, str[i], color, style);
    }
  }

  centerText(y, str, color, style) {
    this.text(Math.floor((this.cols - str.length) / 2), y, str, color, style);
  }

  // Single-line box outline with its top-left at (x, y), size w x h cells.
  box(x, y, w, h, color) {
    this.put(x, y, "┌", color);
    this.put(x + w - 1, y, "┐", color);
    this.put(x, y + h - 1, "└", color);
    this.put(x + w - 1, y + h - 1, "┘", color);
    for (let i = 1; i < w - 1; i++) {
      this.put(x + i, y, "─", color);
      this.put(x + i, y + h - 1, "─", color);
    }
    for (let j = 1; j < h - 1; j++) {
      this.put(x, y + j, "│", color);
      this.put(x + w - 1, y + j, "│", color);
    }
  }

  // Fill a rectangle with a background colour (drawn behind chars, spaces included).
  fill(x, y, w, h, bg) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const cx = x + i;
        const cy = y + j;
        if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) continue;
        this.fills[cy * this.cols + cx] = bg;
      }
    }
  }

  // Register a tappable area (cells). Later zones win when they overlap.
  zone(x, y, w, h, id) {
    this.zones.push({ x, y, w, h, id });
  }

  // Page pixel position -> grid cell, or null when outside the canvas.
  cellAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = Math.floor(((clientX - rect.left) / rect.width) * this.cols);
    const cy = Math.floor(((clientY - rect.top) / rect.height) * this.rows);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return null;
    return { x: cx, y: cy };
  }

  // Id of the zone under a grid cell (from the last frame), or null.
  zoneAt(cell) {
    if (!cell) return null;
    for (let i = this.lastZones.length - 1; i >= 0; i--) {
      const z = this.lastZones[i];
      if (cell.x >= z.x && cell.x < z.x + z.w && cell.y >= z.y && cell.y < z.y + z.h) return z.id;
    }
    return null;
  }

  flush() {
    const { ctx, cols, rows, cellW, cellH } = this;
    const n = cols * rows;
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, cols * cellW, rows * cellH);

    // 1) solid cell fills (tiles, buttons), 2) glow boxes behind single chars
    for (let i = 0; i < n; i++) {
      const f = this.fills[i];
      if (!f) continue;
      ctx.fillStyle = f;
      ctx.fillRect((i % cols) * cellW, Math.floor(i / cols) * cellH, cellW + 0.5, cellH + 0.5);
    }
    for (let i = 0; i < n; i++) {
      const bg = this.bgs[i];
      if (!bg || this.chars[i] === " ") continue;
      ctx.fillStyle = bg;
      ctx.fillRect((i % cols) * cellW + cellW * 0.08, Math.floor(i / cols) * cellH + cellH * 0.04, cellW * 0.84, cellH * 0.92);
    }
    // 3) normal chars, 4) bold chars (font switch only once)
    for (const pass of [0, 1]) {
      ctx.font = pass ? this.fontBold : this.fontNormal;
      const dy = pass ? -cellH * 0.04 : 1;
      for (let i = 0; i < n; i++) {
        const ch = this.chars[i];
        if (ch === " " || this.bold[i] !== pass) continue;
        ctx.fillStyle = this.colors[i];
        ctx.fillText(ch, (i % cols) * cellW + cellW / 2, Math.floor(i / cols) * cellH + dy);
      }
    }
    this.lastZones = this.zones;
  }
}

// Slow drifting dots behind the menus.
export class Ambient {
  constructor(cols, rows, count = 50) {
    this.cols = cols;
    this.rows = rows;
    this.dots = Array.from({ length: count }, () => this.spawn(Math.random() * rows));
  }

  spawn(y) {
    const layer = Math.random();
    return {
      x: Math.floor(Math.random() * this.cols),
      y,
      speed: 0.6 + layer * 2.5,
      ch: layer > 0.85 ? "+" : ".",
      color: layer > 0.85 ? "#4f6a5a" : layer > 0.45 ? "#3c5a48" : "#22382b",
    };
  }

  update(dt) {
    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];
      d.y += d.speed * dt;
      if (d.y >= this.rows) this.dots[i] = this.spawn(0);
    }
  }

  draw(r) {
    for (const d of this.dots) r.put(d.x, d.y, d.ch, d.color);
  }
}
