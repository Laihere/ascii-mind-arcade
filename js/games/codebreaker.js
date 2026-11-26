// CODE BREAKER: guess a hidden code of coloured pegs. After each guess:
//   solid white = right colour in the right place, ring = right colour in the wrong place.
// Crack codes one after another; the run ends when a code isn't cracked in time.
import { hud, button, panel, fmtTime } from "../ui.js";
import { T, tint } from "../theme.js";

// Peg colours; the number inside each peg also helps colour-blind players + keyboard.
export const PEGS = ["#ff4d4d", "#ff9f1c", "#ffd23f", "#3ddc84", "#22d3ee", "#ff4fd8", "#4d7cff", "#b15cff"];

// How many pegs are exact (right place) and near (right colour, wrong place).
export function scoreGuess(secret, guess) {
  let exact = 0;
  const left = {};
  const rest = [];
  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) exact++;
    else {
      left[secret[i]] = (left[secret[i]] || 0) + 1;
      rest.push(guess[i]);
    }
  }
  let near = 0;
  for (const g of rest) {
    if (left[g] > 0) {
      near++;
      left[g]--;
    }
  }
  return { exact, near };
}

export function makeSecret(rng, slots, symbols, repeats) {
  if (repeats) return Array.from({ length: slots }, () => rng.int(symbols));
  return rng.shuffle([...Array(symbols).keys()]).slice(0, slots);
}

// Points for one cracked code.
export function codePoints(cfg, triesUsed, seconds) {
  const timeBonus = Math.max(0, Math.floor(cfg.timeBonusSec - seconds)) * cfg.timeBonusPerSec;
  return cfg.basePoints + (cfg.tries - triesUsed) * cfg.perTryLeft + timeBonus;
}

export class CodeBreaker {
  constructor({ title, cfg, rng }, hooks) {
    this.title = title;
    this.cfg = cfg;
    this.rng = rng;
    this.hooks = hooks;
    this.score = 0;
    this.solved = 0;
    this.total = 0; // seconds over the whole run
    this.newCode();
  }

  newCode() {
    const { slots, symbols, repeats } = this.cfg;
    this.secret = makeSecret(this.rng, slots, symbols, repeats);
    this.rows = []; // { guess, exact, near }
    this.guess = new Array(this.cfg.slots).fill(null); // null = empty slot
    this.codeTime = 0;
    this.phase = "play"; // play | cracked | failed
    this.timer = 0;
    this.msg = "";
  }

  update(dt) {
    this.total += dt;
    if (this.phase === "play") {
      this.codeTime += dt;
      return;
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.phase === "cracked") this.newCode();
    else if (this.phase === "failed") {
      this.phase = "over";
      const n = this.solved;
      this.hooks.onEnd({
        won: n > 0,
        title: n ? `${n} CODE${n > 1 ? "S" : ""} CRACKED` : "GAME OVER",
        score: this.score,
        detail: `${n} code${n === 1 ? "" : "s"} · ${fmtTime(this.total)}`,
      });
    }
  }

  get filled() {
    return this.guess.filter((g) => g !== null).length;
  }

  // Put a colour in the first empty slot.
  add(sym) {
    if (this.phase !== "play" || sym >= this.cfg.symbols) return;
    const i = this.guess.indexOf(null);
    if (i >= 0) this.guess[i] = sym;
  }

  // Remove the last colour placed (rightmost filled slot).
  undo() {
    if (this.phase !== "play") return;
    for (let i = this.guess.length - 1; i >= 0; i--) {
      if (this.guess[i] !== null) {
        this.guess[i] = null;
        return;
      }
    }
  }

  check() {
    if (this.phase !== "play" || this.filled < this.cfg.slots) return;
    const { exact, near } = scoreGuess(this.secret, this.guess);
    this.rows.push({ guess: this.guess, exact, near });
    this.guess = new Array(this.cfg.slots).fill(null);
    if (exact === this.cfg.slots) {
      const pts = codePoints(this.cfg, this.rows.length, this.codeTime);
      this.score += pts;
      this.solved++;
      this.phase = "cracked";
      this.timer = 1.8;
      this.msg = `CRACKED IN ${this.rows.length}! +${pts}`;
    } else if (this.rows.length >= this.cfg.tries) {
      this.phase = "failed";
      this.timer = 3;
      this.msg = "OUT OF TRIES";
    }
  }

  tap(id) {
    if (id.startsWith("sym")) this.add(Number(id.slice(3)));
    else if (id === "undo") this.undo();
    else if (id === "check") this.check();
    else if (id.startsWith("slot") && this.phase === "play") this.guess[Number(id.slice(4))] = null; // take that peg out
  }

  key(e) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= this.cfg.symbols) this.add(n - 1);
    else if (e.key === "Backspace" || e.key === "Delete") this.undo();
    else if (e.key === "Enter" || e.key === " ") this.check();
    else return false;
    return true;
  }

  // A colour peg: round, shiny, number inside. d = diameter in cell heights.
  peg(r, cx, cy, d, sym, opts = {}) {
    r.circle(cx, cy, d / 2, opts.dim ? tint(PEGS[sym], -0.55) : PEGS[sym], { shine: !opts.dim, edge: tint(PEGS[sym], -0.4) });
    const size = Math.max(0.55, d * 0.45);
    r.label(cx, cy - size / 2, String(sym + 1), T.ink, { size, align: "center" });
  }

  // 2x2 clue pegs: solid white = right place, white ring = right colour wrong place.
  clues(r, x, cy, d, exact, near) {
    const cw = d / 0.6; // a clue cell, in cols
    for (let k = 0; k < 4; k++) {
      const px = x + (k % 2) * (cw + 0.25) + cw / 2;
      const py = cy + (Math.floor(k / 2) - 0.5) * (d + 0.12);
      if (k < exact) r.circle(px, py, d / 2, T.text, { edge: "#000" });
      else if (k < exact + near) r.circle(px, py, d / 2 - 0.06, T.text, { ring: Math.max(2, r.cellH * d * 0.22) });
      else r.circle(px, py, d * 0.18, T.edge);
    }
  }

  draw(r) {
    const { slots, symbols, tries } = this.cfg;
    hud(r, this.title, `#${this.solved + 1}  ${this.score} PTS  ${fmtTime(this.total)}`, this.rng.seed);
    const top = 4.2;
    const btnH = 3;

    if (r.cols >= 56) {
      // WIDE (landscape): board on the left, legend + tray + buttons on the right
      const pitch = Math.min(2.8, (r.rows - top - 0.8 - 1.2) / (tries + 1.3));
      const b = this.boardSize(pitch);
      const trayCols = 2;
      const trayD = Math.min(3.4, (r.rows - top - 12) / 3.6);
      const tray = this.traySize(trayD, trayCols);
      const rightW = Math.max(tray.w, 22);
      const gap = 3;
      const bx = (r.cols - (b.w + gap + rightW)) / 2;
      this.drawBoard(r, bx, top, pitch, b);
      const rx = bx + b.w + gap;
      const colH = 2.6 + tray.h + 0.8 + 1.6 + btnH;
      let y = top + Math.max(0, (b.h - colH) / 2);
      this.drawLegend(r, rx + rightW / 2, y, true);
      y += 2.6;
      this.drawTray(r, rx + (rightW - tray.w) / 2, y, trayD, trayCols);
      y += tray.h + 0.8;
      this.drawMessage(r, rx + rightW / 2, y);
      y += 1.6;
      this.drawActions(r, rx + rightW / 2, y, btnH);
      return;
    }

    // TALL (portrait): board, legend/message, tray, buttons stacked
    const trayD = Math.min(3, ((r.cols - 4) / symbols - 0.9) * 0.6);
    const tray = this.traySize(trayD, symbols);
    const bottomH = 1.8 + tray.h + 0.6 + btnH + 0.8;
    const pitch = Math.min(2.8, (r.rows - top - bottomH - 1.2) / (tries + 1.3));
    const b = this.boardSize(pitch);
    this.drawBoard(r, (r.cols - b.w) / 2, top, pitch, b);
    let y = top + b.h + 0.5;
    if (this.msg) this.drawMessage(r, r.cols / 2, y);
    else this.drawLegend(r, r.cols / 2, y, false);
    y += 1.8;
    this.drawTray(r, (r.cols - tray.w) / 2, y, trayD, symbols);
    y += tray.h + 0.6;
    this.drawActions(r, r.cols / 2, y, btnH);
  }

  // Board geometry for a row pitch (cells).
  boardSize(pitch) {
    const { slots, tries } = this.cfg;
    const d = pitch * 0.8; // peg diameter (rows)
    const pegW = d / 0.6 + 1.1; // step between pegs (cols)
    const clueD = Math.min(d * 0.42, (pitch - 0.12) / 2);
    const clueW = 2 * (clueD / 0.6) + 0.25;
    const numW = 3;
    const rowW = numW + slots * pegW + 1 + clueW;
    return { d, pegW, clueD, numW, rowW, w: rowW + 2.4, h: pitch * (tries + 1.3) + 0.9 };
  }

  drawBoard(r, bx, by, pitch, b) {
    const { slots, tries } = this.cfg;
    const { d, pegW, clueD, numW } = b;
    const x0 = bx + 1.2;
    const pegX = (i) => x0 + numW + i * pegW + pegW / 2;
    const clueX = x0 + numW + slots * pegW + 0.6;
    panel(r, bx, by, b.w, b.h);

    // secret row
    let y = by + 0.5;
    const reveal = this.phase !== "play";
    for (let i = 0; i < slots; i++) {
      if (reveal) this.peg(r, pegX(i), y + pitch / 2, d, this.secret[i]);
      else {
        const w = d / 0.6;
        r.block(pegX(i) - w / 2, y + pitch / 2 - d / 2, w, d, T.edge, { inset: 0 });
        r.label(pegX(i), y + pitch / 2 - d * 0.25, "?", T.text, { size: d * 0.5, align: "center" });
      }
    }
    y += pitch * 1.3;
    r.bar(bx + 0.8, y - pitch * 0.15 - 0.06, b.w - 1.6, 0.12, T.edge);

    // guess rows
    const current = this.phase === "play" ? this.rows.length : -1;
    const nextSlot = this.guess.indexOf(null);
    for (let t = 0; t < tries; t++) {
      const cy = y + t * pitch + pitch / 2;
      const past = this.rows[t];
      if (t === current) r.bar(bx + 0.4, cy - pitch / 2 + 0.05, b.w - 0.8, pitch - 0.1, T.panelHi, { round: 6 });
      const numSize = Math.min(0.9, pitch * 0.45);
      r.label(x0 + numW - 1, cy - numSize / 2, String(t + 1), t === current ? T.accent : T.muted, { size: numSize, align: "right" });
      for (let i = 0; i < slots; i++) {
        const cx = pegX(i);
        if (past) this.peg(r, cx, cy, d, past.guess[i]);
        else if (t === current && this.guess[i] !== null) {
          this.peg(r, cx, cy, d, this.guess[i]);
          r.zone(cx - pegW / 2, cy - pitch / 2, pegW, pitch, "slot" + i);
        } else if (t === current) {
          r.circle(cx, cy, d / 2 - 0.05, i === nextSlot ? T.accent : T.edge, { ring: i === nextSlot ? 3 : 2 });
        } else r.circle(cx, cy, d * 0.16, T.edge);
      }
      if (past) this.clues(r, clueX, cy, clueD, past.exact, past.near);
    }
  }

  // Key to the clue pegs. cx = centre; stacked = one item per line.
  drawLegend(r, cx, y, stacked) {
    const ls = 0.7;
    const items = [
      ["RIGHT SPOT", (x, yy) => r.circle(x, yy, 0.33, T.text)],
      ["RIGHT COLOUR", (x, yy) => r.circle(x, yy, 0.28, T.text, { ring: 2 })],
    ];
    if (stacked) {
      const w = 1.6 + r.labelW(items[1][0], ls);
      items.forEach(([text, icon], k) => {
        const lx = cx - w / 2;
        icon(lx + 0.6, y + k * 1.2 + 0.5);
        r.label(lx + 1.6, y + k * 1.2 + 0.5 - ls / 2, text, T.muted, { size: ls });
      });
      return;
    }
    const gap = 2.5;
    const w = 3.2 + r.labelW(items[0][0], ls) + gap + r.labelW(items[1][0], ls);
    let lx = cx - w / 2;
    for (const [text, icon] of items) {
      icon(lx + 0.6, y + 0.5);
      r.label(lx + 1.6, y + 0.5 - ls / 2, text, T.muted, { size: ls });
      lx += 1.6 + r.labelW(text, ls) + gap;
    }
  }

  drawMessage(r, cx, y) {
    if (!this.msg) return;
    const col = this.phase === "failed" ? T.bad : T.good;
    r.label(cx, y, this.msg, col, { size: 1, align: "center", shadow: "#000" });
  }

  traySize(trayD, perRow) {
    const step = trayD / 0.6 + 0.9;
    const lines = Math.ceil(this.cfg.symbols / perRow);
    return { step, w: perRow * step + 1.2, h: lines * (trayD + 0.6) + 0.6 };
  }

  drawTray(r, x, y, trayD, perRow) {
    const { step, w, h } = this.traySize(trayD, perRow);
    panel(r, x, y, w, h);
    for (let s = 0; s < this.cfg.symbols; s++) {
      const col = s % perRow;
      const line = Math.floor(s / perRow);
      const cx = x + 0.6 + col * step + step / 2;
      const top = y + 0.3 + line * (trayD + 0.6);
      this.peg(r, cx, top + 0.3 + trayD / 2, trayD, s, { dim: this.phase !== "play" });
      r.zone(cx - step / 2, top, step, trayD + 0.6, "sym" + s);
    }
  }

  // UNDO (secondary) + CHECK (primary, the one filled accent button), centred on cx.
  drawActions(r, cx, y, h) {
    const size = 0.85;
    const uw = Math.ceil(r.labelW("UNDO", size) + 5);
    const cw = Math.ceil(r.labelW("CHECK", size) + 6);
    const ax = cx - (uw + cw + 1.5) / 2;
    button(r, ax, y, "UNDO", "undo", { h, w: uw, size, disabled: this.phase !== "play" || this.filled === 0 });
    button(r, ax + uw + 1.5, y, "CHECK", "check", {
      h,
      w: cw,
      size,
      primary: true,
      disabled: this.phase !== "play" || this.filled < this.cfg.slots,
    });
  }
}
