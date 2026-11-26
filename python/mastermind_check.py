"""Check the Code Breaker rules and see how many tries a smart player needs.

    python3 python/mastermind_check.py

1. Tests the feedback rule (● exact, ○ right colour wrong place) on tricky cases,
   the same cases the game must get right (js/games/codebreaker.js scoreGuess).
2. Plays every possible secret code with a simple strategy: "always guess a code
   that still fits every clue so far". Prints how many tries that takes.
"""

import json
from collections import Counter
from itertools import product
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))["games"]["codebreaker"]["classic"]


def score(secret, guess):
    """Return (exact, near) for one guess."""
    exact = sum(s == g for s, g in zip(secret, guess))
    common = sum((Counter(secret) & Counter(guess)).values())  # colours in both, ignoring place
    return exact, common - exact


def test_rules():
    cases = [
        ((0, 1, 2, 3), (0, 1, 2, 3), (4, 0)),
        ((0, 0, 1, 1), (1, 1, 0, 0), (0, 4)),
        ((0, 0, 1, 2), (0, 1, 0, 0), (1, 2)),
        ((1, 2, 3, 4), (5, 5, 5, 5), (0, 0)),
        ((0, 1, 1, 1), (1, 0, 0, 0), (0, 2)),
    ]
    for secret, guess, want in cases:
        got = score(secret, guess)
        assert got == want, f"{secret} vs {guess}: got {got}, want {want}"
    print(f"Feedback rule: {len(cases)} tricky cases OK")


def play(secret, codes):
    """Consistent-guess strategy: returns how many tries it took."""
    left = codes
    guess = (0, 0, 1, 1) if len(secret) == 4 else codes[0]  # classic opening
    for tries in range(1, 50):
        clue = score(secret, guess)
        if clue[0] == len(secret):
            return tries
        left = [c for c in left if score(c, guess) == clue]
        guess = left[0]
    raise RuntimeError("never solved")


def main():
    test_rules()
    slots, symbols = CFG["slots"], CFG["symbols"]
    codes = list(product(range(symbols), repeat=slots))
    print(f"Playing all {len(codes)} codes ({slots} slots, {symbols} colours, repeats allowed)...")
    tries = Counter(play(s, codes) for s in codes)
    avg = sum(t * n for t, n in tries.items()) / len(codes)
    for t in sorted(tries):
        print(f"  {t:2} tries: {tries[t]:5}  {'#' * max(1, tries[t] // 20)}")
    print(f"Average {avg:.2f} tries, worst {max(tries)}. The game gives {CFG['tries']} tries.")


if __name__ == "__main__":
    main()
