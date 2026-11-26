// CODE BREAKER: guess a hidden code of coloured pegs. After each guess:
//   ● = right colour in the right place, ○ = right colour in the wrong place.
// Crack codes one after another; the run ends when a code isn't cracked in time.
import { C, hud, button, fmtTime } from "../ui.js";

// Peg colours; the digit inside each peg also works for colour-blind players + keyboard.
export const PEGS = ["#ff5c5c", "#ffcc4d", "#5cff8a", "#5ce1ff", "#a08cff", "#ff8fd8", "#ff9a3c", "#e8f0ea"];
const INK = "#05070a";

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
    this.guess = [];
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

  add(sym) {
    if (this.phase !== "play" || sym >= this.cfg.symbols) return;
    if (this.guess.length < this.cfg.slots) this.guess.push(sym);
  }

  undo() {
    if (this.phase === "play") this.guess.pop();
  }

  check() {
    if (this.phase !== "play" || this.guess.length < this.cfg.slots) return;
    const { exact, near } = scoreGuess(this.secret, this.guess);
    this.rows.push({ guess: this.guess, exact, near });
    this.guess = [];
    if (exact === this.cfg.slots) {
      const pts = codePoints(this.cfg, this.rows.length, this.codeTime);
      this.score += pts;
      this.solved++;
      this.phase = "cracked";
      this.timer = 1.8;
      this.msg = `CRACKED in ${this.rows.length}!  +${pts}`;
    } else if (this.rows.length >= this.cfg.tries) {
      this.phase = "failed";
      this.timer = 3;
      this.msg = "OUT OF TRIES - the code is shown at the top";
    }
  }

  tap(id) {
    if (id.startsWith("sym")) this.add(Number(id.slice(3)));
    else if (id === "undo") this.undo();
    else if (id === "check") this.check();
    else if (id.startsWith("slot")) {
      // tap a filled slot in the current row to clear it and everything after it
      const i = Number(id.slice(4));
      if (this.phase === "play" && i < this.guess.length) this.guess.length = i;
    }
  }

  key(e) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= this.cfg.symbols) this.add(n - 1);
    else if (e.key === "Backspace" || e.key === "Delete") this.undo();
    else if (e.key === "Enter" || e.key === " ") this.check();
    else return false;
    return true;
  }

  // One peg: 3 cells wide, coloured block with its number.
  peg(r, x, y, sym, opts = {}) {
    if (sym === undefined) {
      r.fill(x, y, 3, 1, opts.current ? C.btnBg : null);
      r.put(x + 1, y, "·", opts.current ? C.fg : C.faint);
      return;
    }
    r.fill(x, y, 3, 1, opts.dim ? shade(PEGS[sym]) : PEGS[sym]);
    r.put(x + 1, y, String(sym + 1), INK, { bold: true });
  }

  draw(r) {
    const { slots, symbols, tries } = this.cfg;
    hud(r, this.title, `#${this.solved + 1}  ${this.score} pts  ${fmtTime(this.total)}`, this.rng.seed);

    // vertical budget: hud(3) + secret+gap(2) + rows + gap + msg + gap + palette(3) + gap + actions(3)
    const pitch = r.rows >= 16 + (tries - 1) * 2 ? 2 : 1;
    const rowW = 3 + slots * 4 + 1 + slots;
    const x0 = Math.floor((r.cols - rowW) / 2);
    const pegX = x0 + 3;
    let y = 3;

    // secret row
    const reveal = this.phase !== "play";
    r.text(x0, y, "?", C.accent, { bold: true });
    for (let i = 0; i < slots; i++) {
      if (reveal) this.peg(r, pegX + i * 4, y, this.secret[i]);
      else {
        r.fill(pegX + i * 4, y, 3, 1, C.faint);
        r.put(pegX + i * 4 + 1, y, "?", C.dim);
      }
    }
    y += 2;

    // guess rows: past guesses, then the current one, then empty slots
    for (let t = 0; t < tries; t++) {
      const ry = y + t * pitch;
      const past = this.rows[t];
      const isCurrent = !past && t === this.rows.length && this.phase === "play";
      r.text(x0, ry, String(t + 1).padStart(2), isCurrent ? C.accent : C.dim);
      for (let i = 0; i < slots; i++) {
        const sx = pegX + i * 4;
        if (past) this.peg(r, sx, ry, past.guess[i], { dim: false });
        else if (isCurrent) {
          this.peg(r, sx, ry, this.guess[i], { current: true });
          if (i < this.guess.length) r.zone(sx, ry, 3, 1, "slot" + i);
        } else this.peg(r, sx, ry, undefined);
      }
      if (past) {
        const fx = pegX + slots * 4 + 1;
        for (let i = 0; i < slots; i++) {
          const ch = i < past.exact ? "●" : i < past.exact + past.near ? "○" : "·";
          r.put(fx + i, ry, ch, i < past.exact ? C.white : i < past.exact + past.near ? C.white : C.faint, { bold: ch === "●" });
        }
      }
    }
    y += (tries - 1) * pitch + 2;

    // message line
    if (this.msg) r.centerText(y, this.msg, this.phase === "failed" ? C.danger : C.accent, { bold: true });
    y += 2;

    // palette: big tappable colour buttons (width shrinks on narrow screens)
    const pw = r.cols >= symbols * 6 + 2 ? 5 : 4;
    const palW = symbols * (pw + 1) - 1;
    const px = Math.floor((r.cols - palW) / 2);
    for (let s = 0; s < symbols; s++) {
      const bx = px + s * (pw + 1);
      r.fill(bx, y, pw, 3, this.phase === "play" ? PEGS[s] : shade(PEGS[s]));
      r.put(bx + Math.floor(pw / 2), y + 1, String(s + 1), INK, { bold: true });
      r.zone(bx, y, pw, 3, "sym" + s);
    }
    y += 4;

    // actions
    const undoL = "⌫ UNDO";
    const checkL = "CHECK ✓";
    const aw = undoL.length + 2 + 2 + checkL.length + 2;
    const ax = Math.floor((r.cols - aw) / 2);
    button(r, ax, y, undoL, "undo", { h: 3, disabled: this.phase !== "play" || !this.guess.length });
    button(r, ax + undoL.length + 4, y, checkL, "check", {
      h: 3,
      bold: true,
      color: C.accent,
      disabled: this.phase !== "play" || this.guess.length < slots,
    });
  }
}

// Darker version of a #rrggbb colour (for faded pegs).
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * 0.35);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
