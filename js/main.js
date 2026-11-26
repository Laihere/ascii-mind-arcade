import { CONFIG } from "./config.js";
import { Renderer, Ambient } from "./render.js";
import { Leaderboard } from "./leaderboard.js";
import { makeRng, randomSeed } from "./rng.js";
import { GAMES, DIFFS } from "./games/index.js";

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
let ambient = new Ambient(grid.cols, grid.rows);

// Puzzles are turn-based, so the layout can follow rotation even mid-game.
window.addEventListener("resize", () => {
  const next = pickGrid();
  if (next.cols === grid.cols && next.rows === grid.rows) return;
  grid = next;
  renderer.setGrid(grid.cols, grid.rows);
  ambient = new Ambient(grid.cols, grid.rows);
});

const panels = { home: $("home"), pick: $("pick"), board: $("board"), share: $("share"), pause: $("pause"), result: $("result") };
let state = "home";
let game = null;
let current = { id: "codebreaker", diff: "normal", seed: 0 };
let lastResult = null;

function show(next, focusId) {
  state = next;
  for (const [name, el] of Object.entries(panels)) el.classList.toggle("hidden", name !== next);
  $("btn-pause").classList.toggle("hidden", next !== "game");
  if (focusId) $(focusId).focus();
}

// ---- pick a game + difficulty ----
function showPick(id) {
  current.id = id;
  $("pick-title").textContent = GAMES[id].title;
  $("pick-blurb").textContent = GAMES[id].blurb;
  show("pick");
  const btn = document.querySelector(`#diff-menu [data-diff="${current.diff}"]`);
  btn.focus();
}

function seedFromInput() {
  const n = parseInt($("seed-input").value, 10);
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : 0;
}

// seed 0 = pick a random one
function startGame(diff = current.diff, seed = seedFromInput()) {
  current.diff = diff;
  current.seed = seed || randomSeed();
  const info = GAMES[current.id];
  game = new info.Game(
    { title: info.title, cfg: CONFIG.games[current.id][diff], diff, rng: makeRng(current.seed), touch: isTouch },
    { onEnd: endGame },
  );
  show("game");
}

function endGame(result) {
  lastResult = result;
  const board = boardFor(current.id, current.diff);
  $("res-title").textContent = result.won ? "SOLVED!" : "GAME OVER";
  $("res-score").textContent = result.score;
  $("res-detail").textContent = `${GAMES[current.id].title} · ${current.diff.toUpperCase()} · seed ${current.seed} · ${result.detail}`;
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
function boardFor(id, diff) {
  const key = `${id}.${diff}`;
  if (!boards[key]) boards[key] = new Leaderboard(CONFIG.leaderboard, key);
  return boards[key];
}
let view = { id: "codebreaker", diff: "normal" };

function showBoard(highlightId = null, message = "") {
  for (const t of document.querySelectorAll("#board-games .tab")) t.classList.toggle("on", t.dataset.game === view.id);
  for (const t of document.querySelectorAll("#board-diffs .tab")) t.classList.toggle("on", t.dataset.diff === view.diff);
  const rows = boardFor(view.id, view.diff).load();
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
  const board = boardFor(current.id, current.diff);
  const raw = $("name-input").value;
  const err = board.validate(raw);
  if (err) {
    $("name-error").textContent = err;
    $("name-input").focus();
    return;
  }
  const { rank, id } = board.add(raw, lastResult.score, lastResult.detail);
  lastResult = null;
  view = { id: current.id, diff: current.diff };
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
for (const b of document.querySelectorAll("#diff-menu [data-diff]")) b.addEventListener("click", () => startGame(b.dataset.diff));
$("seed-form").addEventListener("submit", (e) => {
  e.preventDefault();
  startGame();
});
$("btn-pick-back").addEventListener("click", quitToMenu);
for (const t of document.querySelectorAll("#board-games .tab")) t.addEventListener("click", () => { view.id = t.dataset.game; showBoard(); });
for (const t of document.querySelectorAll("#board-diffs .tab")) t.addEventListener("click", () => { view.diff = t.dataset.diff; showBoard(); });
$("btn-board").addEventListener("click", () => showBoard());
$("btn-board-back").addEventListener("click", quitToMenu);
$("btn-board-play").addEventListener("click", () => showPick(view.id));
$("btn-board-clear").addEventListener("click", () => {
  if (confirm(`Clear ${GAMES[view.id].title} ${view.diff.toUpperCase()} scores on this browser?`)) {
    boardFor(view.id, view.diff).clear();
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
