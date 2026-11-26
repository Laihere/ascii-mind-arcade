// BLOCK RECALL: some blocks light up for a moment, then hide. Tap every one you saw.
// Clear a level -> one more block next time. A wrong tap costs a life and replays the
// level with a new pattern. EASY/NORMAL/HARD keep one board size; STAGES grows the
// board and shortens the flash as you go.
import { hud, panel, fmtTime } from "../ui.js";
import { T } from "../theme.js";

const LIT = T.accent;
const GOOD = T.good;
const BAD = T.bad;
const HIDDEN = "#3a3a8c";
const INK = T.ink;

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
    hud(r, this.title, `LV ${this.level}  ${hearts}  ${this.score} PTS`, this.rng.seed);

    // square tiles in pixels (a cell is 0.6 as wide as tall), as big as fit
    const n = this.size;
    const top = 4.6;
    const availH = r.rows - top - 4;
    const availW = r.cols - 3;
    const gap = 0.35; // rows between tiles
    const th = Math.min(5, (availH - gap * (n - 1)) / n, ((availW - (gap / 0.6) * (n - 1)) * 0.6) / n);
    const tw = th / 0.6;
    const gapW = gap / 0.6;
    const gw = n * tw + (n - 1) * gapW;
    const gh = n * th + (n - 1) * gap;
    const x0 = (r.cols - gw) / 2;
    const y0 = top + (availH - gh) / 2;
    panel(r, x0 - 0.8, y0 - 0.5, gw + 1.6, gh + 1);

    const showAll = this.phase === "show" || this.phase === "missed";
    const mark = (tx, ty, text, color) => {
      const size = Math.min(1.6, th * 0.4);
      r.label(tx + tw / 2, ty + th / 2 - size / 2, text, color, { size, align: "center" });
    };
    for (let i = 0; i < n * n; i++) {
      const tx = x0 + (i % n) * (tw + gapW);
      const ty = y0 + Math.floor(i / n) * (th + gap);
      if (i === this.wrong) {
        r.block(tx, ty, tw, th, BAD, { inset: 0 });
        mark(tx, ty, "X", INK);
      } else if (this.found.has(i) || (this.phase === "cleared" && this.pattern.has(i))) {
        r.block(tx, ty, tw, th, GOOD, { inset: 0 });
        mark(tx, ty, "✓", INK);
      } else if (showAll && this.pattern.has(i)) {
        r.block(tx, ty, tw, th, LIT, { inset: 0 });
      } else {
        r.block(tx, ty, tw, th, HIDDEN, { inset: 0, bevel: 0.7 });
      }
      r.zone(tx, ty, tw, th, "t" + i);
    }

    const color = this.phase === "missed" ? T.bad : this.phase === "recall" ? T.text : T.accent;
    const size = 0.95;
    r.label(r.cols / 2, Math.min(r.rows - 2, y0 + gh + 1.4), this.msg.toUpperCase(), color, { size, align: "center", shadow: "#000" });
  }
}
