import { CONFIG } from "./config.js";
import { Renderer, Ambient } from "./render.js";
import { BLOCKS, tint } from "./theme.js";
import { Leaderboard } from "./leaderboard.js";
import { makeRng, randomSeed } from "./rng.js";
import { GAMES, DIFF_LABELS } from "./games/index.js";

const $ = (id) => document.getElementById(id);

const canvas = $("screen");
const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
document.body.classList.toggle("touch", isTouch);

// Grid size: 60x34 on wide screens; on an upright phone use fewer, bigger
// columns and as many rows as fit, so the board fills the screen.
function pickGrid() {
  const { cols, rows, portraitCols, maxRows } = CONFIG.grid;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (h < w * 1.15) return { cols, rows };
  const cellW = w / portraitCols;
  const fitRows = Math.floor(h / (cellW / 0.6));
  return { cols: portraitCols, rows: Math.max(rows, Math.min(maxRows, fitRows)) };
}

let grid = pickGrid();
const renderer = new Renderer(canvas, grid.cols, grid.rows);
renderer.hudInset = isTouch ? 6 : 0;
let ambient = new Ambient(grid.cols, grid.rows, BLOCKS);

// Puzzles are turn-based, so the layout can follow rotation even mid-game.
window.addEventListener("resize", () => {
  const next = pickGrid();
  if (next.cols === grid.cols && next.rows === grid.rows) return;
  grid = next;
  renderer.setGrid(grid.cols, grid.rows);
  ambient = new Ambient(grid.cols, grid.rows, BLOCKS);
});

// ---- block-letter logo: every "#" is a raised block, each letter its own colour ----
const LETTERS = {
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#"],
  D: ["####.", "#...#", "#...#", "#...#", "####."],
  A: [".###.", "#...#", "#####", "#...#", "#...#"],
  R: ["####.", "#...#", "####.", "#..#.", "#...#"],
  C: [".####", "#....", "#....", "#....", ".####"],
  E: ["#####", "#....", "####.", "#....", "#####"],
};
function drawLogo(cv) {
  const words = ["MIND", "ARCADE"];
  const px = 14; // block size in canvas pixels
  const widthOf = (w) => [...w].reduce((sum, ch) => sum + LETTERS[ch][0].length + 1, -1);
  const cols = Math.max(...words.map(widthOf));
  cv.width = cols * px;
  cv.height = (5 * 2 + 2) * px;
  const ctx = cv.getContext("2d");
  let colour = 0;
  words.forEach((word, wi) => {
    let x = Math.floor((cols - widthOf(word)) / 2);
    for (const ch of word) {
      const c = BLOCKS[[0, 1, 2, 3, 4, 5, 6, 7][colour++ % 7]];
      LETTERS[ch].forEach((row, ry) => {
        [...row].forEach((cell, rx) => {
          if (cell !== "#") return;
          const bx = (x + rx) * px;
          const by = (wi * 6 + ry + (wi ? 1 : 0)) * px;
          ctx.fillStyle = tint(c, -0.5);
          ctx.fillRect(bx, by, px, px);
          ctx.fillStyle = tint(c, 0.45);
          ctx.fillRect(bx, by, px - 2, px - 2);
          ctx.fillStyle = c;
          ctx.fillRect(bx + 3, by + 3, px - 6, px - 6);
        });
      });
      x += LETTERS[ch][0].length + 1;
    }
  });
}
drawLogo($("logo"));

const panels = { home: $("home"), pick: $("pick"), board: $("board"), share: $("share"), pause: $("pause"), result: $("result") };
let state = "home";
let game = null;
let current = { id: "codebreaker", diff: "classic", seed: 0 };
const lastDiff = {}; // remembered difficulty per game

// Default difficulty for a game: last one played, else NORMAL (or its only mode).
const defaultDiff = (id) => lastDiff[id] || (GAMES[id].diffs.includes("normal") ? "normal" : GAMES[id].diffs[0]);

function makeButtons(nav, cls, diffs, onClick, on) {
  nav.replaceChildren();
  for (const d of diffs) {
    const b = document.createElement("button");
    b.className = cls + (d === on ? " on" : "");
    b.dataset.diff = d;
    b.textContent = DIFF_LABELS[d];
    b.addEventListener("click", () => onClick(d));
    nav.appendChild(b);
  }
}
let lastResult = null;

function show(next, focusId) {
  state = next;
  for (const [name, el] of Object.entries(panels)) el.classList.toggle("hidden", name !== next);
  $("btn-pause").classList.toggle("hidden", next !== "game");
  if (focusId) $(focusId).focus();
}

// ---- time-limit choice (modes whose config has minutesOptions, e.g. TIME ATTACK) ----
const minuteOpts = (id, diff) => (CONFIG.games[id][diff] || {}).minutesOptions || null;
const defaultMinutes = (id, diff) => Math.round(((CONFIG.games[id][diff] || {}).timeLimitSec || 180) / 60);
const chosenMinutes = {}; // per game, remembered
const timedDiff = (id) => GAMES[id].diffs.find((d) => minuteOpts(id, d));

function minuteTabs(nav, opts, on, onPick) {
  nav.replaceChildren();
  for (const m of opts) {
    const b = document.createElement("button");
    b.className = "tab" + (m === on ? " on" : "");
    b.textContent = `${m} MIN`;
    b.setAttribute("aria-pressed", String(m === on));
    b.addEventListener("click", () => onPick(m));
    nav.appendChild(b);
  }
}

function renderTimeRow(id) {
  const td = timedDiff(id);
  $("time-row").classList.toggle("hidden", !td);
  if (!td) return;
  const on = chosenMinutes[id] ?? defaultMinutes(id, td);
  minuteTabs($("time-tabs"), minuteOpts(id, td), on, (m) => {
    chosenMinutes[id] = m;
    renderTimeRow(id);
  });
}

// "TIME ATTACK 3 MIN" style label for a mode
const modeLabel = (id, diff, mins) => DIFF_LABELS[diff] + (minuteOpts(id, diff) ? ` ${mins} MIN` : "");

// ---- pick a game + difficulty ----
function showPick(id) {
  current.id = id;
  $("pick-title").textContent = GAMES[id].title;
  $("pick-blurb").textContent = GAMES[id].blurb;
  const diffs = GAMES[id].diffs;
  makeButtons($("diff-menu"), "btn", diffs, (d) => startGame(d));
  $("diff-hint").textContent = GAMES[id].hint || "";
  renderTimeRow(id);
  show("pick");
  document.querySelector(`#diff-menu [data-diff="${defaultDiff(id)}"]`).focus();
}

function seedFromInput() {
  const n = parseInt($("seed-input").value, 10);
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : 0;
}

// seed 0 = pick a random one
function startGame(diff = current.diff, seed = seedFromInput()) {
  current.diff = diff;
  lastDiff[current.id] = diff;
  current.seed = seed || randomSeed();
  const info = GAMES[current.id];
  let cfg = CONFIG.games[current.id][diff];
  current.minutes = null;
  if (minuteOpts(current.id, diff)) {
    current.minutes = chosenMinutes[current.id] ?? defaultMinutes(current.id, diff);
    cfg = { ...cfg, timeLimitSec: current.minutes * 60 };
  }
  game = new info.Game(
    { title: info.title, cfg, diff, rng: makeRng(current.seed), touch: isTouch },
    { onEnd: endGame },
  );
  show("game");
}

function endGame(result) {
  lastResult = result;
  const board = boardFor(current.id, current.diff, current.minutes);
  $("res-title").textContent = result.title || (result.won ? "SOLVED!" : "GAME OVER");
  $("res-score-label").textContent = result.scoreLabel || "SCORE";
  $("res-score").textContent = result.score;
  $("res-detail").textContent = `${GAMES[current.id].title}${GAMES[current.id].diffs.length > 1 ? " · " + modeLabel(current.id, current.diff, current.minutes) : ""} · seed ${current.seed} · ${result.detail}`;
  const top = board.load()[0];
  const qualifies = board.qualifies(result.score);
  $("res-note").textContent = !qualifies ? (result.score > 0 ? `Not quite top ${CONFIG.leaderboard.size} this time.` : "")
    : !top || result.score > top.score ? "NEW HIGH SCORE!" : "You made the leaderboard!";
  $("name-form").classList.toggle("hidden", !qualifies);
  $("res-actions").classList.toggle("hidden", qualifies);
  $("name-error").textContent = "";
  $("name-input").value = board.lastName();
  show("result", qualifies ? "name-input" : "btn-again");
  if (qualifies) $("name-input").select();
}

// ---- leaderboard ----
const boards = {};
// One board per game + mode (+ time limit, so 1-minute and 5-minute runs don't compete).
function boardFor(id, diff, minutes) {
  const key = `${id}.${diff}` + (minuteOpts(id, diff) ? `.${minutes ?? defaultMinutes(id, diff)}m` : "");
  if (!boards[key]) boards[key] = new Leaderboard(CONFIG.leaderboard, key);
  return boards[key];
}
let view = { id: "codebreaker", diff: "classic", minutes: null };

function showBoard(highlightId = null, message = "") {
  for (const t of document.querySelectorAll("#board-games .tab")) t.classList.toggle("on", t.dataset.game === view.id);
  const diffs = GAMES[view.id].diffs;
  if (!diffs.includes(view.diff)) view.diff = defaultDiff(view.id);
  makeButtons($("board-diffs"), "tab", diffs.length > 1 ? diffs : [], (d) => { view.diff = d; showBoard(); }, view.diff);
  const mopts = minuteOpts(view.id, view.diff);
  $("board-mins").classList.toggle("hidden", !mopts);
  if (mopts) {
    if (!mopts.includes(view.minutes)) view.minutes = chosenMinutes[view.id] ?? defaultMinutes(view.id, view.diff);
    minuteTabs($("board-mins"), mopts, view.minutes, (m) => { view.minutes = m; showBoard(); });
  }
  $("board-score-th").textContent = (GAMES[view.id].scoreLabels || {})[view.diff] || "SCORE";
  const rows = boardFor(view.id, view.diff, view.minutes).load();
  const body = $("board-rows");
  body.replaceChildren();
  rows.forEach((r, i) => {
    const tr = document.createElement("tr");
    if (r.id && r.id === highlightId) tr.className = "me";
    for (const v of [i + 1, r.name, r.score, r.detail ?? "-"]) {
      const td = document.createElement("td");
      td.textContent = String(v); // never innerHTML: names are user input
      tr.appendChild(td);
    }
    body.appendChild(tr);
  });
  $("board-empty").classList.toggle("hidden", rows.length > 0);
  $("board-msg").textContent = message;
  $("board-msg").classList.toggle("hidden", !message);
  if (state !== "board") show("board", "btn-board-back");
}

function saveScore(e) {
  e.preventDefault();
  if (!lastResult) return;
  const board = boardFor(current.id, current.diff, current.minutes);
  const raw = $("name-input").value;
  const err = board.validate(raw);
  if (err) {
    $("name-error").textContent = err;
    $("name-input").focus();
    return;
  }
  const { rank, id } = board.add(raw, lastResult.score, lastResult.detail);
  lastResult = null;
  view = { id: current.id, diff: current.diff, minutes: current.minutes };
  game = null;
  showBoard(id, rank ? `${raw.trim()} placed #${rank}!` : `${raw.trim()}: not in the top ${CONFIG.leaderboard.size} this time.`);
}

// ---- pause ----
function togglePause() {
  if (!game) return;
  if (state === "game") show("pause", "btn-resume");
  else if (state === "pause") show("game");
}

function quitToMenu() {
  game = null;
  lastResult = null;
  show("home");
  document.querySelector(`#game-menu [data-game="${current.id}"]`).focus();
}

// ---- share / QR (link + QR image are made by python/make_qr.py) ----
const shareUrl = (CONFIG.share && CONFIG.share.url) || location.origin + location.pathname;

// No QR yet (python/make_qr.py not run since the repo went live): show just the link.
const qr = $("share-qr");
qr.addEventListener("error", () => qr.classList.add("hidden"));
if (qr.complete && !qr.naturalWidth) qr.classList.add("hidden"); // failed before this script ran

function showShare() {
  $("share-url").textContent = shareUrl;
  $("share-msg").textContent = "";
  $("btn-native-share").classList.toggle("hidden", !navigator.share);
  show("share", "btn-share-back");
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl);
    $("share-msg").textContent = "Link copied!";
  } catch {
    $("share-msg").textContent = "Couldn't copy - press and hold the link above to copy it.";
  }
}

async function nativeShare() {
  try {
    await navigator.share({ title: "ASCII MIND ARCADE", text: "Can you beat my score?", url: shareUrl });
  } catch {
    /* user closed the share sheet */
  }
}

// ---- wiring ----
for (const b of document.querySelectorAll("#game-menu [data-game]")) b.addEventListener("click", () => showPick(b.dataset.game));
$("seed-form").addEventListener("submit", (e) => {
  e.preventDefault();
  startGame(defaultDiff(current.id));
});
$("btn-pick-back").addEventListener("click", quitToMenu);
for (const t of document.querySelectorAll("#board-games .tab")) t.addEventListener("click", () => { view.id = t.dataset.game; showBoard(); });
$("btn-board").addEventListener("click", () => showBoard());
$("btn-board-back").addEventListener("click", quitToMenu);
$("btn-board-play").addEventListener("click", () => showPick(view.id));
$("btn-board-clear").addEventListener("click", () => {
  if (confirm(`Clear ${GAMES[view.id].title} ${modeLabel(view.id, view.diff, view.minutes)} scores on this browser?`)) {
    boardFor(view.id, view.diff, view.minutes).clear();
    showBoard();
  }
});
$("btn-share").addEventListener("click", showShare);
$("btn-share-back").addEventListener("click", quitToMenu);
$("btn-copy").addEventListener("click", copyLink);
$("btn-native-share").addEventListener("click", nativeShare);
$("btn-pause").addEventListener("click", togglePause);
$("btn-resume").addEventListener("click", togglePause);
$("btn-restart").addEventListener("click", () => startGame(current.diff, 0));
$("btn-quit").addEventListener("click", quitToMenu);
$("name-form").addEventListener("submit", saveScore);
$("btn-skip").addEventListener("click", quitToMenu);
$("btn-again").addEventListener("click", () => startGame(current.diff, 0));
$("btn-res-menu").addEventListener("click", quitToMenu);

// Taps on the canvas go to whatever zone the game drew there.
canvas.addEventListener("pointerdown", (e) => {
  if (state !== "game" || !game) return;
  const id = renderer.zoneAt(renderer.cellAt(e.clientX, e.clientY));
  if (id !== null) {
    e.preventDefault();
    game.tap(id);
  }
});

window.addEventListener("keydown", (e) => {
  if (!game || (state !== "game" && state !== "pause")) return;
  if ((e.code === "KeyP" || e.code === "Escape") && !e.repeat) {
    togglePause();
    e.preventDefault();
  } else if (state === "game" && game.key(e)) {
    e.preventDefault();
  }
});

// Pause automatically when the tab is hidden
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "game") togglePause();
});

// Main loop: ambient dots on the menus; the game draws itself while active.
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  renderer.clear();
  if (game && state === "game") game.update(dt);
  if (game && state !== "home" && state !== "pick" && state !== "board" && state !== "share") {
    game.draw(renderer);
  } else {
    ambient.update(dt);
    ambient.draw(renderer);
  }
  renderer.flush();
  requestAnimationFrame(frame);
}

show("home");
requestAnimationFrame(frame);

// Test hook, only when running on this computer (never on the live site),
// so nobody can read the game's state (e.g. the secret code) from the console.
if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  window.__mind = {
    get game() { return game; },
    // page pixel centre of a tap zone
    zoneCenter(id) {
      const z = renderer.lastZones.find((q) => q.id === id);
      if (!z) return null;
      const b = canvas.getBoundingClientRect();
      return [b.left + ((z.x + z.w / 2) / renderer.cols) * b.width, b.top + ((z.y + z.h / 2) / renderer.rows) * b.height];
    },
  };
}
