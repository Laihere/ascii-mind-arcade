"""Print the difficulty + points tables from config.json, to tune the games.

    python3 python/balance.py

Edit config.json, run python3 python/build_config.py, then reload the page.
The maths here mirrors js/games/*.js (levelParams, codePoints, puzzlePoints).
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))["games"]


def recall_level(cfg, level):
    if "size" in cfg:
        size = cfg["size"]
        cap = int(size * size * cfg["maxFill"])
        return size, min(cap, cfg["startBlocks"] + level - 1), cfg["flashMs"]
    blocks = cfg["startBlocks"] + level - 1
    size = cfg["startSize"]
    while size < cfg["maxSize"] and blocks > int(size * size * cfg["maxFill"]):
        size += 1
    blocks = min(blocks, int(size * size * cfg["maxFill"]))
    flash = max(cfg["minFlashMs"], cfg["flashMs"] - cfg["flashStepMs"] * (level - 1))
    return size, blocks, flash


def code_points(cfg, tries_used, seconds):
    bonus = max(0, int(cfg["timeBonusSec"] - seconds)) * cfg["timeBonusPerSec"]
    return cfg["basePoints"] + (cfg["tries"] - tries_used) * cfg["perTryLeft"] + bonus


def pipe_points(cfg, path_len, par, moves, seconds):
    spare = max(0, par + cfg["spareMoves"] - moves)
    bonus = max(0, int(cfg["timeBonusSec"] - seconds)) * cfg["timeBonusPerSec"]
    return path_len * cfg["perPathTile"] + spare * cfg["perSpareMove"] + bonus


def main():
    cb = GAMES["codebreaker"]["classic"]
    print("CODE BREAKER - points for one cracked code")
    print("  tries ->  " + "".join(f"{t:>6}" for t in (2, 4, 5, 6, 8, 10)))
    for sec in (20, 60, 120):
        print(f"  {sec:>3}s       " + "".join(f"{code_points(cb, t, sec):>6}" for t in (2, 4, 5, 6, 8, 10)))

    print("\nBLOCK RECALL - board / blocks / flash ms per level")
    levels = (1, 3, 5, 8, 12, 16, 20)
    print("  level ->  " + "".join(f"{lv:>12}" for lv in levels))
    for mode, cfg in GAMES["recall"].items():
        cells = "".join(f"{'%dx%d/%d/%d' % (s, s, b, f):>12}" for s, b, f in (recall_level(cfg, lv) for lv in levels))
        print(f"  {mode:<9}" + cells)
    r = GAMES["recall"]["normal"]
    print(f"  points: {r['perBlock']} per block + {r['perLevel']} x level when cleared")

    print("\nPIPE LINK - points for one board (route 20 tiles, par 22)")
    pc = GAMES["pipes"]["normal"]
    print("  moves ->  " + "".join(f"{m:>6}" for m in (22, 27, 32, 40, 60)))
    for sec in (30, 90, 180):
        print(f"  {sec:>3}s       " + "".join(f"{pipe_points(pc, 20, 22, m, sec):>6}" for m in (22, 27, 32, 40, 60)))
    print("  STAGES boards: " + ", ".join(f"{w}x{h}" for w, h in GAMES["pipes"]["stages"]["sizes"]))


if __name__ == "__main__":
    main()
