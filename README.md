# ASCII MIND ARCADE

Three puzzle games drawn entirely in text characters, in the browser. Every round is a
new random puzzle. Works with a mouse, a keyboard or a phone. No installs and no server:
it is plain HTML + JavaScript, so it runs on GitHub Pages.

| Game | How to play | Modes |
| --- | --- | --- |
| **CODE BREAKER** | Guess the secret 4-colour code (colours can repeat) in 10 tries. After each guess: `●` = right colour, right place, `○` = right colour, wrong place. Crack code after code until you miss one. | one mode |
| **BLOCK RECALL** | Blocks light up for a moment, then hide. Tap every block you saw. Each level adds a block; a wrong tap costs one of 3 lives. | EASY / NORMAL / HARD (fixed 4x4 / 5x5 / 6x6 board) · STAGES (board grows 3x3 → 7x7, flash gets shorter) |
| **PIPE LINK** | Tap a pipe to turn it. Link **S** to **F** so the water flows. | EASY / NORMAL / HARD (one 5x5 / 7x7 / 9x9 board) · STAGES (10 boards, 4x4 → 9x9; END RUN keeps your points) |

**Keyboard (Code Breaker):** `1`-`6` pick a colour, `Backspace` undo, `Enter` check.
**Anywhere:** `P` / `Esc` pause.

### Points

- **Code Breaker:** each code = 100 + 50 for every unused try + a speed bonus (2 per second under 90 s).
- **Block Recall:** 10 per block found + 20 x level for each level cleared.
- **Pipe Link:** 20 per tile on the route + 10 for each spare move (up to par + 10) + a speed bonus (2 per second under 120 s).
  *Par* = the fewest turns that solve the board.

Leaderboards are kept for each game and mode, saved in the browser only (`localStorage`).

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
css/style.css         green-screen look, phone layout
config.json           all difficulty + points numbers  ->  python/build_config.py  ->  js/config.js
js/main.js            screen router, taps/keys, main loop
js/render.js          character-grid renderer on a <canvas>, tap zones
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
