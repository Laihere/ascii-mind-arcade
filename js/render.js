// Grid renderer on a <canvas>. The screen is a cols x rows grid of cells, used for
// layout and tap zones. Games draw with:
//   fill()   solid cell backgrounds         block()  raised arcade block (bevelled)
//   circle() round peg / dot                bar()    solid rectangle (pipes)
//   label()  pixel-font text                put()/text()  single characters
// flush() paints it all: fills, then shapes/labels in call order, then characters.
import { T, PIXEL_FONT, tint } from "./theme.js";

const MONO = '"Cascadia Mono", "Consolas", "DejaVu Sans Mono", "Menlo", monospace';
const CHAR_ASPECT = 0.6; // cell width / height
const LABEL_EM = 0.7; // pixel-font size as a share of the label height

export class Renderer {
  constructor(canvas, cols, rows) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hudInset = 0; // cols kept free top-right (phone pause button sits there)
    this.setGrid(cols, rows);
    window.addEventListener("resize", () => this.resize());
  }

  setGrid(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows;
    this.chars = new Array(n).fill(" ");
    this.colors = new Array(n).fill("#fff");
    this.bold = new Uint8Array(n);
    this.fills = new Array(n).fill(null);
    this.ops = [];
    this.zones = [];
    this.lastZones = [];
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const availW = window.innerWidth - 4;
    const availH = window.innerHeight - 4;
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
    this.fontNormal = `${Math.floor(cellH * 0.92)}px ${MONO}`;
    this.fontBold = `bold ${Math.floor(cellH * 1.05)}px ${MONO}`;
  }

  clear() {
    this.chars.fill(" ");
    this.bold.fill(0);
    this.fills.fill(null);
    this.ops = [];
    this.zones = [];
  }

  // ---- characters ----
  put(x, y, ch, color, style) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.chars[i] = ch;
    this.colors[i] = color;
    this.bold[i] = style && style.bold ? 1 : 0;
  }

  text(x, y, str, color, style) {
    for (let i = 0; i < str.length; i++) if (str[i] !== " ") this.put(x + i, y, str[i], color, style);
  }

  centerText(y, str, color, style) {
    this.text(Math.floor((this.cols - str.length) / 2), y, str, color, style);
  }

  // ---- cell fills ----
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

  // ---- shapes (all positions/sizes in cells, fractions allowed) ----
  // Raised arcade block. opts: { inset (cells, default 0.1), flat, alpha, bevel (0-1 strength) }
  block(x, y, w, h, color, opts = {}) {
    this.ops.push({ k: "block", x, y, w, h, color, o: opts });
  }

  // Circle centred at (cx, cy); radius in cell HEIGHTS. opts: { ring (line width in px), shine, alpha, edge }
  circle(cx, cy, radius, color, opts = {}) {
    this.ops.push({ k: "circle", x: cx, y: cy, rad: radius, color, o: opts });
  }

  // Plain filled rectangle. opts: { alpha, round (px corner radius) }
  bar(x, y, w, h, color, opts = {}) {
    this.ops.push({ k: "bar", x, y, w, h, color, o: opts });
  }

  // Pixel-font text. y = top of a line `size` cells tall.
  // opts: { size (cells, default 1), align: left|center|right, shadow }
  label(x, y, str, color, opts = {}) {
    this.ops.push({ k: "label", x, y, str: String(str), color, o: opts });
  }

  // Width of a label in cells (pixel font: every glyph is 1em wide).
  labelW(str, size = 1) {
    return (String(str).length * size * LABEL_EM) / CHAR_ASPECT;
  }

  // ---- taps ----
  zone(x, y, w, h, id) {
    this.zones.push({ x, y, w, h, id });
  }

  cellAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = ((clientX - rect.left) / rect.width) * this.cols;
    const cy = ((clientY - rect.top) / rect.height) * this.rows;
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return null;
    return { x: cx, y: cy };
  }

  zoneAt(cell) {
    if (!cell) return null;
    for (let i = this.lastZones.length - 1; i >= 0; i--) {
      const z = this.lastZones[i];
      if (cell.x >= z.x && cell.x < z.x + z.w && cell.y >= z.y && cell.y < z.y + z.h) return z.id;
    }
    return null;
  }

  // ---- paint ----
  flush() {
    const { ctx, cols, rows, cellW, cellH } = this;
    ctx.globalAlpha = 1;
    ctx.fillStyle = T.bg;
    ctx.fillRect(0, 0, cols * cellW, rows * cellH);

    // runs of the same fill on a row are painted as one rect on whole pixels (no seams)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; ) {
        const f = this.fills[y * cols + x];
        let end = x + 1;
        while (end < cols && this.fills[y * cols + end] === f) end++;
        if (f) {
          const px = Math.round(x * cellW);
          ctx.fillStyle = f;
          ctx.fillRect(px, y * cellH, Math.round(end * cellW) - px, cellH);
        }
        x = end;
      }
    }

    for (const op of this.ops) {
      ctx.globalAlpha = op.o.alpha ?? 1;
      if (op.k === "block") this.paintBlock(op);
      else if (op.k === "circle") this.paintCircle(op);
      else if (op.k === "bar") {
        ctx.fillStyle = op.color;
        const r = op.o.round || 0;
        if (r) {
          ctx.beginPath();
          ctx.roundRect(op.x * cellW, op.y * cellH, op.w * cellW, op.h * cellH, r);
          ctx.fill();
        } else ctx.fillRect(op.x * cellW, op.y * cellH, op.w * cellW, op.h * cellH);
      } else if (op.k === "label") this.paintLabel(op);
    }
    ctx.globalAlpha = 1;

    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    for (const pass of [0, 1]) {
      ctx.font = pass ? this.fontBold : this.fontNormal;
      const dy = pass ? -cellH * 0.04 : 1;
      for (let i = 0; i < cols * rows; i++) {
        const ch = this.chars[i];
        if (ch === " " || this.bold[i] !== pass) continue;
        ctx.fillStyle = this.colors[i];
        ctx.fillText(ch, (i % cols) * cellW + cellW / 2, Math.floor(i / cols) * cellH + dy);
      }
    }
    this.lastZones = this.zones;
  }

  paintBlock({ x, y, w, h, color, o }) {
    const { ctx, cellW, cellH } = this;
    const inset = o.inset ?? 0.1;
    const px = x * cellW + inset * cellW;
    const py = y * cellH + inset * cellW;
    const pw = w * cellW - 2 * inset * cellW;
    const ph = h * cellH - 2 * inset * cellW;
    if (pw <= 0 || ph <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(px, py, pw, ph);
    if (o.flat) return;
    const b = Math.max(2, Math.min(7, Math.min(pw, ph) * 0.13));
    const s = o.bevel ?? 1;
    ctx.fillStyle = tint(color, 0.5 * s);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + pw, py);
    ctx.lineTo(px + pw - b, py + b);
    ctx.lineTo(px + b, py + b);
    ctx.lineTo(px + b, py + ph - b);
    ctx.lineTo(px, py + ph);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tint(color, -0.45 * s);
    ctx.beginPath();
    ctx.moveTo(px + pw, py);
    ctx.lineTo(px + pw, py + ph);
    ctx.lineTo(px, py + ph);
    ctx.lineTo(px + b, py + ph - b);
    ctx.lineTo(px + pw - b, py + ph - b);
    ctx.lineTo(px + pw - b, py + b);
    ctx.closePath();
    ctx.fill();
  }

  paintCircle({ x, y, rad, color, o }) {
    const { ctx, cellW, cellH } = this;
    const cx = x * cellW;
    const cy = y * cellH;
    const r = rad * cellH;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (o.ring) {
      ctx.strokeStyle = color;
      ctx.lineWidth = o.ring;
      ctx.stroke();
      return;
    }
    ctx.fillStyle = color;
    ctx.fill();
    if (o.edge) {
      ctx.strokeStyle = o.edge;
      ctx.lineWidth = Math.max(1.5, r * 0.12);
      ctx.stroke();
    }
    if (o.shine) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.arc(cx - r * 0.32, cy - r * 0.32, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  paintLabel({ x, y, str, color, o }) {
    const { ctx, cellW, cellH } = this;
    const size = o.size ?? 1;
    const fontPx = Math.max(6, Math.round(size * cellH * LABEL_EM));
    ctx.font = `${fontPx}px ${PIXEL_FONT}`;
    ctx.textBaseline = "top";
    ctx.textAlign = o.align || "left";
    const px = x * cellW;
    const py = y * cellH + (size * cellH - fontPx) / 2;
    if (o.shadow) {
      ctx.fillStyle = o.shadow;
      ctx.fillText(str, px + Math.max(1, fontPx / 8), py + Math.max(1, fontPx / 8));
    }
    ctx.fillStyle = color;
    ctx.fillText(str, px, py);
  }
}

// Slow falling single blocks behind the menus.
export class Ambient {
  constructor(cols, rows, colors, count = 18) {
    this.cols = cols;
    this.rows = rows;
    this.colors = colors;
    this.items = Array.from({ length: count }, () => this.spawn(Math.random() * rows));
  }

  spawn(y) {
    const size = 1 + Math.random() * 1.5;
    return {
      x: Math.random() * this.cols,
      y,
      size,
      speed: 0.5 + Math.random() * 1.5,
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
      alpha: 0.08 + Math.random() * 0.12,
    };
  }

  update(dt) {
    for (let i = 0; i < this.items.length; i++) {
      const b = this.items[i];
      b.y += b.speed * dt;
      if (b.y >= this.rows) this.items[i] = this.spawn(-2);
    }
  }

  draw(r) {
    for (const b of this.items) r.block(b.x, b.y, b.size, b.size * 0.6, b.color, { alpha: b.alpha, inset: 0 });
  }
}
