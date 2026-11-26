// BLOCK RECALL: some blocks light up for a moment, then hide. Tap every one you saw.
// Clear a level -> one more block next time. A wrong tap costs a life and replays the
// level with a new pattern. EASY/NORMAL/HARD keep one board size; STAGES grows the
// board and shortens the flash as you go.
import { C, hud, fmtTime } from "../ui.js";

const LIT = "#ffcc4d";
const GOOD = "#5cff8a";
const BAD = "#ff5c5c";
const HIDDEN = "#0d2416";
const INK = "#05070a";

// Board size, block count and flash time for a level.
export function levelParams(cfg, level) {
  if (cfg.size) {
    const cap = Math.floor(cfg.size * cfg.size * cfg.maxFill);
    return { size: cfg.size, blocks: Math.min(cap, cfg.startBlocks + level - 1), flash: cfg.flashMs };
  }
  // STAGES: the smallest board (from startSize) that holds the blocks without getting crowded
  let blocks = cfg.startBlocks + level - 1;
  let size = cfg.startSize;
  while (size < cfg.maxSize && blocks > Math.floor(size * size * cfg.maxFill)) size++;
  blocks = Math.min(blocks, Math.floor(size * size * cfg.maxFill));
  const flash = Math.max(cfg.minFlashMs, cfg.flashMs - cfg.flashStepMs * (level - 1));
  return { size, blocks, flash };
}

export function makePattern(rng, size, blocks) {
  return new Set(rng.shuffle([...Array(size * size).keys()]).slice(0, blocks));
}

export class BlockRecall {
  constructor({ title, cfg, rng }, hooks) {
    this.title = title;
    this.cfg = cfg;
    this.rng = rng;
    this.hooks = hooks;
    this.level = 1;
    this.lives = cfg.lives;
    this.score = 0;
    this.best = 0; // highest level cleared
    this.time = 0;
    this.startLevel();
  }

  startLevel() {
    const p = levelParams(this.cfg, this.level);
    this.size = p.size;
    this.flash = p.flash / 1000;
    this.pattern = makePattern(this.rng, p.size, p.blocks);
    this.found = new Set();
    this.wrong = -1;
    this.phase = "ready"; // ready -> show -> recall -> (cleared | missed) -> ready ...
    this.timer = 0.9;
    this.msg = `LEVEL ${this.level} · ${p.blocks} blocks`;
  }

  update(dt) {
    this.time += dt;
    if (this.phase === "recall" || this.phase === "over") return;
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.phase === "ready") {
      this.phase = "show";
      this.timer = this.flash;
      this.msg = "WATCH...";
    } else if (this.phase === "show") {
      this.phase = "recall";
      this.msg = `YOUR TURN · ${this.pattern.size} to find`;
    } else if (this.phase === "cleared") {
      this.best = this.level;
      this.level++;
      this.startLevel();
    } else if (this.phase === "missed") {
      if (this.lives > 0) this.startLevel();
      else this.finish();
    }
  }

  finish() {
    this.phase = "over";
    this.hooks.onEnd({
      won: this.best > 0,
      title: this.best ? `CLEARED ${this.best} LEVEL${this.best > 1 ? "S" : ""}` : "GAME OVER",
      score: this.score,
      detail: `level ${this.best} · ${fmtTime(this.time)}`,
    });
  }

  tap(id) {
    if (this.phase !== "recall" || !id.startsWith("t")) return;
    const i = Number(id.slice(1));
    if (this.found.has(i)) return;
    if (this.pattern.has(i)) {
      this.found.add(i);
      this.score += this.cfg.perBlock;
      if (this.found.size === this.pattern.size) {
        const bonus = this.cfg.perLevel * this.level;
        this.score += bonus;
        this.phase = "cleared";
        this.timer = 1.1;
        this.msg = `PERFECT! +${this.pattern.size * this.cfg.perBlock + bonus}`;
      } else this.msg = `YOUR TURN · ${this.pattern.size - this.found.size} to find`;
    } else {
      this.wrong = i;
      this.lives--;
      this.phase = "missed";
      this.timer = 1.6;
      this.msg = this.lives > 0 ? "MISS! Same level, new pattern." : "MISS! No lives left.";
    }
  }

  key() {
    return false;
  }

  draw(r) {
    const hearts = "♥".repeat(this.lives) + "·".repeat(Math.max(0, this.cfg.lives - this.lives));
    hud(r, this.title, `LV ${this.level}  ${hearts}  ${this.score} pts`, this.rng.seed);

    // tiles as square as the char cells allow (a cell is ~0.6 as wide as tall)
    const n = this.size;
    const top = 4;
    const availH = r.rows - top - 4;
    const availW = r.cols - 2;
    let th = Math.max(1, Math.floor((availH + 1) / n) - 1);
    let tw = Math.max(2, Math.round(th / 0.6));
    if (n * (tw + 1) - 1 > availW) {
      tw = Math.max(2, Math.floor((availW + 1) / n) - 1);
      th = Math.max(1, Math.min(th, Math.round(tw * 0.6)));
    }
    const gw = n * (tw + 1) - 1;
    const gh = n * (th + 1) - 1;
    const x0 = Math.floor((r.cols - gw) / 2);
    const y0 = top + Math.floor((availH - gh) / 2);

    const showAll = this.phase === "show" || this.phase === "missed";
    for (let i = 0; i < n * n; i++) {
      const tx = x0 + (i % n) * (tw + 1);
      const ty = y0 + Math.floor(i / n) * (th + 1);
      const cx = tx + Math.floor(tw / 2);
      const cy = ty + Math.floor(th / 2);
      if (i === this.wrong) {
        r.fill(tx, ty, tw, th, BAD);
        r.put(cx, cy, "X", INK, { bold: true });
      } else if (this.found.has(i) || (this.phase === "cleared" && this.pattern.has(i))) {
        r.fill(tx, ty, tw, th, GOOD);
        r.put(cx, cy, "✓", INK, { bold: true });
      } else if (showAll && this.pattern.has(i)) {
        r.fill(tx, ty, tw, th, LIT);
        r.put(cx, cy, "◆", INK);
      } else {
        r.fill(tx, ty, tw, th, HIDDEN);
        r.put(cx, cy, "·", C.dim);
      }
      r.zone(tx, ty, tw, th, "t" + i);
    }

    const color = this.phase === "missed" ? C.danger : this.phase === "recall" ? C.fg : C.accent;
    r.centerText(Math.min(r.rows - 2, y0 + gh + 2), this.msg, color, { bold: true });
  }
}
