// PIPE LINK: every tile is a pipe piece turned at random. Tap a tile to turn it 90°.
// Water comes in at S (left) and must reach F (right). Puzzles are made solvable by
// first carving a random route S -> F, then filling the rest with decoy pieces.
import { hud, button, panel, fmtTime } from "../ui.js";
import { T } from "../theme.js";

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

const PIPE = "#7a7ac8"; // not connected yet
const LINKED = T.good; // connected to S
const WATER = T.water; // flowing after a win
const TILE_A = "#1a1a44";
const TILE_B = "#202052";
const OUTLINE = "#06061a";

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
      this.msg = `CONNECTED IN ${this.moves} (PAR ${this.p.par}) +${pts}`;
    }
  }

  tap(id) {
    if (id.startsWith("p")) this.turn(Number(id.slice(1)));
    else if (id === "end" && this.phase === "play") this.finish(false);
  }

  key() {
    return false;
  }

  // One pipe tile: square-ish in pixels; arms are thick bars from the centre to the edges.
  drawTile(r, x, y, tw, th, m, color, bg) {
    r.block(x, y, tw, th, bg, { inset: 0.08, bevel: 0.35 });
    const t = th * 0.34; // pipe thickness (rows)
    const tc = t / 0.6; // same in cols
    const o = th * 0.06; // outline (rows)
    const oc = o / 0.6;
    const cx = x + tw / 2;
    const cy = y + th / 2;
    const arms = [];
    if (m & N) arms.push([cx - tc / 2, y, tc, th / 2 + t / 2]);
    if (m & S) arms.push([cx - tc / 2, cy - t / 2, tc, th / 2 + t / 2]);
    if (m & W) arms.push([x, cy - t / 2, tw / 2 + tc / 2, t]);
    if (m & E) arms.push([cx - tc / 2, cy - t / 2, tw / 2 + tc / 2, t]);
    // dark outline first (only on the sides, so neighbouring tiles join up), then the pipe
    for (const [ax, ay, aw, ah] of arms) {
      const vertical = ah > aw;
      if (vertical) r.bar(ax - oc, ay, aw + 2 * oc, ah, OUTLINE);
      else r.bar(ax, ay - o, aw, ah + 2 * o, OUTLINE);
    }
    for (const [ax, ay, aw, ah] of arms) r.bar(ax, ay, aw, ah, color);
    // highlight stripe along each arm for a rounded-tube look
    for (const [ax, ay, aw, ah] of arms) {
      if (ah > aw) r.bar(ax + tc * 0.18, ay, tc * 0.18, ah, "rgba(255,255,255,0.35)");
      else r.bar(ax, ay + t * 0.18, aw, t * 0.18, "rgba(255,255,255,0.35)");
    }
  }

  draw(r) {
    const { w, h, rs, rf, tiles } = this.p;
    const right = this.stages
      ? `ST ${this.stage + 1}/${this.stages.length}  ${this.score} PTS`
      : `${this.moves} MOVES  ${fmtTime(this.time)}`;
    hud(r, this.title, right, this.rng.seed);

    // square tiles (in pixels), as big as fit; S and F blocks sit just outside each side
    const top = 4.4;
    const bottom = this.stages ? 6.5 : 3;
    const availH = r.rows - top - bottom;
    const side = (thGuess) => 0.9 + Math.max(1.4, Math.min(2.2, thGuess * 0.7)) / 0.6; // cols per side
    let th = Math.min(4, availH / h, ((r.cols - 2 * side(2)) * 0.6) / w);
    th = Math.min(th, ((r.cols - 2 * side(th) - 0.4) * 0.6) / w); // tile height (rows)
    const tw = th / 0.6; // tile width (cols)
    const gw = w * tw;
    const gh = h * th;
    const x0 = (r.cols - gw) / 2;
    const y0 = top + (availH - gh) / 2;

    const flowing = this.phase === "flowing" || this.phase === "over";
    const wet = (i) => flowing && this.flow.reach.get(i) <= this.timer / 0.05;

    panel(r, x0 - 0.6, y0 - 0.35, gw + 1.2, gh + 0.7);
    for (let i = 0; i < w * h; i++) {
      const gx = i % w;
      const gy = Math.floor(i / w);
      const tx = x0 + gx * tw;
      const ty = y0 + gy * th;
      const color = wet(i) ? WATER : this.flow.reach.has(i) ? LINKED : PIPE;
      this.drawTile(r, tx, ty, tw, th, tiles[i], color, (gx + gy) % 2 ? TILE_A : TILE_B);
      r.zone(tx, ty, tw, th, "p" + i);
    }

    // S (left) and F (right): yellow blocks joined to the board by a pipe stub
    const t = th * 0.34;
    const bs = Math.max(1.4, Math.min(2.2, th * 0.7)); // block height (rows)
    const bw = bs / 0.6;
    const mark = (bx, cy, letter, pipeColor, stubX, stubW) => {
      r.bar(stubX, cy - t / 2 - th * 0.06, stubW, t + th * 0.12, OUTLINE);
      r.bar(stubX, cy - t / 2, stubW, t, pipeColor);
      r.block(bx, cy - bs / 2, bw, bs, T.accent, { inset: 0 });
      r.label(bx + bw / 2, cy - bs * 0.3, letter, T.ink, { size: bs * 0.6, align: "center" });
    };
    const sy = y0 + rs * th + th / 2;
    const fy = y0 + rf * th + th / 2;
    const sPipe = flowing ? WATER : this.flow.reach.size ? LINKED : PIPE;
    mark(x0 - 0.9 - bw, sy, "S", sPipe, x0 - 0.9, 0.9);
    const fWet = this.flow.solved && wet(rf * w + w - 1);
    mark(x0 + gw + 0.9, fy, "F", fWet ? WATER : PIPE, x0 + gw, 0.9);

    const my = y0 + gh + 0.9;
    const col = this.phase === "play" ? T.muted : T.good;
    r.label(r.cols / 2, my, this.msg.toUpperCase(), col, { size: this.phase === "play" ? 0.75 : 0.95, align: "center", shadow: "#000" });
    if (this.stages) {
      const size = 0.8;
      const bw = Math.ceil(r.labelW("END RUN", size) + 4);
      button(r, (r.cols - bw) / 2, my + 2, "END RUN", "end", { h: 3, w: bw, size, disabled: this.phase !== "play" });
    }
  }
}
