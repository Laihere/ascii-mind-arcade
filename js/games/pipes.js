// PIPE LINK: every tile is a pipe piece turned at random. Tap a tile to turn it 90°.
// Water comes in at S (left) and must reach F (right). Puzzles are made solvable by
// first carving a random route S -> F, then filling the rest with decoy pieces.
import { C, hud, button, fmtTime } from "../ui.js";

// Openings as bits: N=1 E=2 S=4 W=8
export const N = 1, E = 2, S = 4, W = 8;
const DIRS = [
  { bit: N, dx: 0, dy: -1, opp: S },
  { bit: E, dx: 1, dy: 0, opp: W },
  { bit: S, dx: 0, dy: 1, opp: N },
  { bit: W, dx: -1, dy: 0, opp: E },
];
const GLYPH = { 3: "╚", 6: "╔", 12: "╗", 9: "╝", 5: "║", 10: "═", 7: "╠", 14: "╦", 13: "╣", 11: "╩", 15: "╬" };

export const rotate = (m) => ((m << 1) | (m >> 3)) & 15; // clockwise

// Fewest clockwise turns to get from piece `from` to `to` (-1 if impossible).
export function turnsBetween(from, to) {
  let m = from;
  for (let k = 0; k < 4; k++) {
    if (m === to) return k;
    m = rotate(m);
  }
  return -1;
}

// Random route from (0, rs) to (w-1, rf): depth-first walk with random turns,
// sometimes nudged towards the finish so routes aren't always huge.
function carvePath(rng, w, h, rs, rf) {
  const seen = new Uint8Array(w * h);
  const path = [];
  const goal = rf * w + (w - 1);
  const walk = (x, y) => {
    const i = y * w + x;
    seen[i] = 1;
    path.push(i);
    if (i === goal) return true;
    const opts = rng.shuffle(DIRS.slice());
    if (rng.next() < 0.3) opts.sort((a, b) => dist(x + a.dx, y + a.dy) - dist(x + b.dx, y + b.dy));
    for (const d of opts) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx]) continue;
      if (walk(nx, ny)) return true;
    }
    path.pop();
    return false;
  };
  const dist = (x, y) => Math.abs(x - (w - 1)) + Math.abs(y - rf);
  walk(0, rs);
  return path;
}

// Build a puzzle: { w, h, rs, rf, tiles (scrambled), solution (route pieces), path, par }
export function makePuzzle(rng, w, h) {
  let rs, rf, path;
  const minLen = w + Math.floor(h / 2);
  const maxLen = Math.floor(w * h * 0.6);
  for (let tries = 0; tries < 60; tries++) {
    rs = rng.int(h);
    rf = rng.int(h);
    path = carvePath(rng, w, h, rs, rf);
    if (path.length >= minLen && path.length <= maxLen) break;
  }

  const tiles = new Array(w * h).fill(0);
  const solution = new Array(w * h).fill(0);
  const onPath = new Set(path);
  const dirTo = (a, b) => DIRS.find((d) => (a % w) + d.dx === b % w && Math.floor(a / w) + d.dy === Math.floor(b / w));
  path.forEach((cell, k) => {
    let m = 0;
    m |= k === 0 ? W : dirTo(cell, path[k - 1]).bit; // inlet from S
    m |= k === path.length - 1 ? E : dirTo(cell, path[k + 1]).bit; // outlet to F
    solution[cell] = m;
  });

  // decoys: mostly straights and corners, a few T pieces
  for (let i = 0; i < w * h; i++) {
    if (onPath.has(i)) tiles[i] = solution[i];
    else {
      const roll = rng.next();
      tiles[i] = roll < 0.4 ? 5 : roll < 0.85 ? 3 : 7;
    }
  }
  // scramble every tile
  for (let i = 0; i < w * h; i++) {
    const k = rng.int(4);
    for (let j = 0; j < k; j++) tiles[i] = rotate(tiles[i]);
  }
  const puzzle = { w, h, rs, rf, tiles, solution, path };
  if (flowFrom(puzzle).solved) tiles[path[0]] = rotate(tiles[path[0]]); // never start solved
  puzzle.par = path.reduce((sum, i) => sum + turnsBetween(tiles[i], solution[i]), 0);
  return puzzle;
}

// Water spread from S: Map cell -> step number, and whether it pours out at F.
export function flowFrom({ w, h, rs, rf, tiles }) {
  const reach = new Map();
  const start = rs * w;
  if (!(tiles[start] & W)) return { reach, solved: false };
  reach.set(start, 0);
  const queue = [start];
  while (queue.length) {
    const i = queue.shift();
    const x = i % w;
    const y = Math.floor(i / w);
    for (const d of DIRS) {
      if (!(tiles[i] & d.bit)) continue;
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (reach.has(n) || !(tiles[n] & d.opp)) continue;
      reach.set(n, reach.get(i) + 1);
      queue.push(n);
    }
  }
  const end = rf * w + (w - 1);
  return { reach, solved: reach.has(end) && !!(tiles[end] & E) };
}

export function puzzlePoints(cfg, pathLen, par, moves, seconds) {
  const spare = Math.max(0, par + cfg.spareMoves - moves);
  const timeBonus = Math.max(0, Math.floor(cfg.timeBonusSec - seconds)) * cfg.timeBonusPerSec;
  return pathLen * cfg.perPathTile + spare * cfg.perSpareMove + timeBonus;
}

const PIPE = "#3f7a4c";
const LINKED = "#9dffb0";
const WATER = "#5ce1ff";
const BG_A = "#0a1810";
const BG_B = "#0e2216";

export class PipeLink {
  constructor({ title, cfg, rng }, hooks) {
    this.title = title;
    this.cfg = cfg;
    this.rng = rng;
    this.hooks = hooks;
    this.stages = cfg.sizes || null; // STAGES mode: list of [w, h]
    this.stage = 0;
    this.score = 0;
    this.time = 0;
    this.totalMoves = 0;
    this.newPuzzle();
  }

  newPuzzle() {
    const [w, h] = this.stages ? this.stages[this.stage] : [this.cfg.w, this.cfg.h];
    this.p = makePuzzle(this.rng, w, h);
    this.moves = 0;
    this.puzzleTime = 0;
    this.flow = flowFrom(this.p);
    this.phase = "play"; // play -> flowing -> (next puzzle | over)
    this.timer = 0;
    this.msg = this.stages ? `STAGE ${this.stage + 1} · ${w}x${h}` : "Tap a pipe to turn it";
  }

  update(dt) {
    this.time += dt;
    if (this.phase === "play") {
      this.puzzleTime += dt;
      return;
    }
    if (this.phase !== "flowing") return;
    this.timer += dt;
    const maxStep = Math.max(...this.flow.reach.values());
    if (this.timer < maxStep * 0.05 + 1.4) return;
    if (this.stages && this.stage < this.stages.length - 1) {
      this.stage++;
      this.newPuzzle();
    } else this.finish(true);
  }

  finish(complete) {
    this.phase = "over";
    const n = this.stages ? this.stage + (complete ? 1 : 0) : 1;
    this.hooks.onEnd({
      won: n > 0,
      title: !this.stages ? "CONNECTED!" : complete ? `ALL ${n} STAGES!` : n ? `${n} STAGE${n === 1 ? "" : "S"} DONE` : "GAME OVER",
      score: this.score,
      detail: this.stages
        ? `stage ${n} · ${this.totalMoves} moves · ${fmtTime(this.time)}`
        : `${this.moves} moves (par ${this.p.par}) · ${fmtTime(this.time)}`,
    });
  }

  turn(i) {
    if (this.phase !== "play") return;
    this.p.tiles[i] = rotate(this.p.tiles[i]);
    this.moves++;
    this.totalMoves++;
    this.flow = flowFrom(this.p);
    if (this.flow.solved) {
      const pts = puzzlePoints(this.cfg, this.p.path.length, this.p.par, this.moves, this.puzzleTime);
      this.score += pts;
      this.phase = "flowing";
      this.timer = 0;
      this.msg = `CONNECTED in ${this.moves} (par ${this.p.par})  +${pts}`;
    }
  }

  tap(id) {
    if (id.startsWith("p")) this.turn(Number(id.slice(1)));
    else if (id === "end" && this.phase === "play") this.finish(false);
  }

  key() {
    return false;
  }

  draw(r) {
    const { w, h, rs, rf, tiles } = this.p;
    const right = this.stages
      ? `ST ${this.stage + 1}/${this.stages.length}  ${this.score} pts`
      : `${this.moves} moves  ${fmtTime(this.time)}`;
    hud(r, this.title, right, this.rng.seed);

    // tile size: 5x3 cells when there's room (looks square), else 3x3, else 3x1
    const top = 3;
    const bottom = this.stages ? 4 : 2;
    const availH = r.rows - top - bottom;
    const tw = w * 5 + 6 <= r.cols ? 5 : 3;
    const th = h * 3 <= availH ? 3 : 1;
    const gw = w * tw;
    const gh = h * th;
    const x0 = Math.floor((r.cols - gw) / 2);
    const y0 = top + Math.floor((availH - gh) / 2);
    const cx = Math.floor(tw / 2);
    const cy = Math.floor(th / 2);

    const flowing = this.phase === "flowing" || this.phase === "over";
    const wet = (i) => flowing && this.flow.reach.get(i) <= this.timer / 0.05;

    for (let i = 0; i < w * h; i++) {
      const gx = i % w;
      const gy = Math.floor(i / w);
      const tx = x0 + gx * tw;
      const ty = y0 + gy * th;
      const m = tiles[i];
      const linked = this.flow.reach.has(i);
      const color = wet(i) ? WATER : linked ? LINKED : PIPE;
      const style = linked ? { bold: true } : undefined;
      r.fill(tx, ty, tw, th, (gx + gy) % 2 ? BG_A : BG_B);
      if (m & N) for (let y = 0; y < cy; y++) r.put(tx + cx, ty + y, "║", color, style);
      if (m & S) for (let y = cy + 1; y < th; y++) r.put(tx + cx, ty + y, "║", color, style);
      if (m & W) for (let x = 0; x < cx; x++) r.put(tx + x, ty + cy, "═", color, style);
      if (m & E) for (let x = cx + 1; x < tw; x++) r.put(tx + x, ty + cy, "═", color, style);
      r.put(tx + cx, ty + cy, GLYPH[m] || "+", color, style);
      r.zone(tx, ty, tw, th, "p" + i);
    }

    // S on the left, F on the right
    const sy = y0 + rs * th + cy;
    const fy = y0 + rf * th + cy;
    r.text(x0 - 2, sy, "S", C.accent, { bold: true });
    r.put(x0 - 1, sy, "═", flowing ? WATER : C.accent, { bold: true });
    r.put(x0 + gw, fy, "═", this.flow.solved && wet(rf * w + w - 1) ? WATER : C.accent, { bold: true });
    r.text(x0 + gw + 1, fy, "F", C.accent, { bold: true });

    const my = y0 + gh + 1;
    r.centerText(my, this.msg, this.phase === "play" ? C.dim : C.accent, { bold: this.phase !== "play" });
    if (this.stages) {
      const label = "END RUN";
      button(r, Math.floor((r.cols - label.length - 2) / 2), my + 2, label, "end", { disabled: this.phase !== "play" });
    }
  }
}
