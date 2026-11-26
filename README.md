# MIND ARCADE

Three puzzle games in a retro arcade style (pixel font, chunky neon blocks), in the browser.
Every round is a new random puzzle. Works with a mouse, a keyboard, a phone or a tablet,
upright or sideways. No installs and no server: plain HTML + JavaScript on a `<canvas>`,
so it runs on GitHub Pages.

| Game | How to play | Modes |
| --- | --- | --- |
| **CODE BREAKER** | Guess the secret 4-colour code (colours can repeat) in 10 tries. After each guess the clue pegs show: solid white = right colour, right place; white ring = right colour, wrong place. Crack code after code. | STREAK (first miss ends the run) · TIME ATTACK (pick 1-5 minutes, 3 by default; as many as you can, misses just move on; one board per length) · ENDLESS (never ends, a miss resets the streak; END when you like; board ranks **best streak**) |
| **BLOCK RECALL** | Blocks light up for a moment, then hide. Tap every block you saw. Each level adds a block; a wrong tap costs one of 3 lives. | EASY / NORMAL / HARD (fixed 4x4 / 5x5 / 6x6 board) · STAGES (board grows 3x3 → 7x7, flash gets shorter) |
| **PIPE LINK** | Tap a pipe to turn it. Link **S** to **F** so the water flows. | EASY / NORMAL / HARD (one 5x5 / 7x7 / 9x9 board) · STAGES (10 boards, 4x4 → 9x9; END RUN keeps your points) |

**Keyboard (Code Breaker):** `1`-`6` pick a colour, `Backspace` undo, `Enter` check.
**Anywhere:** `P` / `Esc` pause.

### Points

- **Code Breaker:** each code = 100 + 50 for every unused try + a speed bonus (2 per second under 90 s). The top bar also shows your current streak (codes cracked in a row).
- **Block Recall:** 10 per block found + 20 x level for each level cleared.
- **Pipe Link:** 20 per tile on the route + 10 for each spare move (up to par + 10) + a speed bonus (2 per second under 120 s).
  *Par* = the fewest turns that solve the board.

Leaderboards are kept for each game and mode, saved in the browser only (`localStorage`).

### Fair play

The game runs entirely in the browser. On the live site the secret code is kept in a private
field and there is no debug hook, so it can't simply be read from the browser console.
(A test hook, `window.__mind`, exists only when the page is served from `localhost`.)
Note: the same seed always gives the same codes, so replaying a seed you've already seen is
an easy "cheat"; use random seeds for leaderboard runs.

### Seeds: same puzzle for everyone

The seed (top left in a game) decides the random puzzle. Type the same seed on the
difficulty screen and everyone gets exactly the same puzzle: good for a class race.

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` straight from the file system won't work: browsers block JS modules on `file://`.)

## Put it online (GitHub Pages)

1. Create a GitHub repo and push this folder to it.
2. Repo **Settings → Pages → Deploy from a branch → `main` / root**.
3. Make the "scan to play" QR code for the live link:

   ```bash
   pip install segno
   python3 python/make_qr.py      # works out the Pages URL from the git remote
   git add -A && git commit -m "QR code" && git push
   ```

## Project layout

```
index.html            menus (home, difficulty, pause, result, leaderboard, share)
css/style.css         arcade look (tokens mirror js/theme.js), phone + tablet layout
js/theme.js           colour tokens + block colours
assets/fonts/         Press Start 2P pixel font (SIL OFL 1.1, see THIRD_PARTY.md)
config.json           all difficulty + points numbers  ->  python/build_config.py  ->  js/config.js
js/main.js            screen router, taps/keys, main loop
js/render.js          grid renderer on a <canvas>: raised blocks, circles, bars, pixel text, tap zones
js/rng.js             seeded random numbers (mulberry32)
js/leaderboard.js     top-10 per game + mode in localStorage
js/ui.js              shared drawing helpers (top bar, buttons)
js/games/
  codebreaker.js      CODE BREAKER
  recall.js           BLOCK RECALL
  pipes.js            PIPE LINK (puzzle generator + water flow)
python/
  build_config.py     config.json -> js/config.js
  balance.py          print difficulty + points tables
  mastermind_check.py test the ● / ○ rule, solve all 1296 codes (avg ~5 tries)
  pipes_check.py      check thousands of generated pipe puzzles really are solvable
  make_qr.py          QR code for the live link
```

### Change the difficulty or points

Edit `config.json`, then:

```bash
python3 python/build_config.py   # rebuild js/config.js
python3 python/balance.py        # see the new tables
python3 python/pipes_check.py    # still all solvable?
```

### How the pipe puzzles stay solvable

`js/games/pipes.js` first walks a random route from S to F (a depth-first walk that
sometimes steers towards F). Those tiles get the exact pieces the route needs. Every other
tile gets a random decoy (straight, corner or T). Then **every** tile is turned a random
number of times. Because the route was built first, there is always an answer.
`python/pipes_check.py` checks this independently.
