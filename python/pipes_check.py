"""Prove the Pipe Link generator only makes solvable puzzles.

    python3 python/pipes_check.py          # 1000 puzzles per board size
    python3 python/pipes_check.py 200

Asks the real game code (js/games/pipes.js, run with Node) for puzzles, then checks
each one here in Python, separately from the game's own code:
  - it does NOT start solved
  - turning the route tiles to their answer lets water flow from S to F
  - "par" really is the fewest turns for that answer
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
N, E, S, W = 1, 2, 4, 8
STEPS = [(N, 0, -1, S), (E, 1, 0, W), (S, 0, 1, N), (W, -1, 0, E)]

NODE = """
import { makePuzzle } from "./js/games/pipes.js";
import { makeRng } from "./js/rng.js";
const [count, sizes] = [Number(process.argv[1]), JSON.parse(process.argv[2])];
const out = [];
for (const [w, h] of sizes) for (let seed = 1; seed <= count; seed++) out.push(makePuzzle(makeRng(seed), w, h));
console.log(JSON.stringify(out));
"""


def rotate(m):
    return ((m << 1) | (m >> 3)) & 15


def water_reaches_f(p, tiles):
    w, h = p["w"], p["h"]
    start = p["rs"] * w
    if not tiles[start] & W:
        return False
    seen, todo = {start}, [start]
    while todo:
        i = todo.pop()
        x, y = i % w, i // w
        for bit, dx, dy, opp in STEPS:
            nx, ny = x + dx, y + dy
            if tiles[i] & bit and 0 <= nx < w and 0 <= ny < h:
                n = ny * w + nx
                if n not in seen and tiles[n] & opp:
                    seen.add(n)
                    todo.append(n)
    end = p["rf"] * w + w - 1
    return end in seen and bool(tiles[end] & E)


def main():
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
    cfg = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))["games"]["pipes"]
    sizes = sorted({(m["w"], m["h"]) for m in cfg.values() if "w" in m} | {tuple(s) for s in cfg["stages"]["sizes"]})
    raw = subprocess.run(
        ["node", "--input-type=module", "-e", NODE, str(count), json.dumps(sizes)],
        cwd=ROOT, capture_output=True, text=True, check=True,
    ).stdout
    puzzles = json.loads(raw)
    problems = 0
    for p in puzzles:
        tiles = list(p["tiles"])
        if water_reaches_f(p, tiles):
            problems += 1
            print("starts solved:", p["w"], p["h"])
        turns = 0
        for i in p["path"]:
            k = 0
            while tiles[i] != p["solution"][i]:
                tiles[i] = rotate(tiles[i])
                k += 1
                if k > 3:
                    raise SystemExit(f"tile {i} can never match its answer")
            turns += k
        if not water_reaches_f(p, tiles):
            problems += 1
            print("answer doesn't connect:", p["w"], p["h"])
        if turns != p["par"]:
            problems += 1
            print("wrong par:", turns, p["par"])
    print(f"Checked {len(puzzles)} puzzles over {len(sizes)} board sizes: {problems} problems.")
    for w, h in sizes:
        mine = [p for p in puzzles if (p["w"], p["h"]) == (w, h)]
        avg_len = sum(len(p["path"]) for p in mine) / len(mine)
        avg_par = sum(p["par"] for p in mine) / len(mine)
        print(f"  {w}x{h}: route {avg_len:5.1f} tiles, par {avg_par:5.1f} turns on average")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
