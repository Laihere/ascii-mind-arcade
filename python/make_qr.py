"""Make the "scan to play" QR code for the live game.

    pip install segno                     # one-time (small, BSD-licensed QR library)
    python3 python/make_qr.py             # URL worked out from the git remote
    python3 python/make_qr.py https://example.github.io/my-game/

Writes:
    assets/qr.svg   shown in the game's SHARE screen
    assets/qr.png   big version to print or send in a chat
and saves the URL into config.json (share.url) + rebuilds js/config.js,
then prints the QR code in the terminal as text so you can scan it right away.

Re-run this after renaming the GitHub repo (the Pages link changes with the name).
"""

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_config  # noqa: E402  (same folder)


def pages_url_from_git() -> str:
    """https://github.com/<user>/<repo>(.git) -> https://<user>.github.io/<repo>/"""
    remote = subprocess.run(
        ["git", "-C", str(ROOT), "remote", "get-url", "origin"], capture_output=True, text=True, check=True
    ).stdout.strip()
    m = re.search(r"github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?$", remote)
    if not m:
        raise SystemExit(f"Can't read a GitHub repo from remote '{remote}'. Pass the URL instead.")
    user, repo = m.groups()
    if repo.lower() == f"{user.lower()}.github.io":
        return f"https://{user.lower()}.github.io/"
    return f"https://{user.lower()}.github.io/{repo}/"


def main() -> None:
    try:
        import segno
    except ImportError:
        raise SystemExit("Needs the segno package:  pip install segno")

    url = sys.argv[1] if len(sys.argv) > 1 else pages_url_from_git()
    if not url.startswith(("https://", "http://")):
        raise SystemExit("URL must start with https://")

    qr = segno.make(url, error="m", micro=False)
    assets = ROOT / "assets"
    assets.mkdir(exist_ok=True)
    qr.save(assets / "qr.svg", scale=1, border=4, dark="#05070a", light="#ffffff", omitsize=True, title="Scan to play")
    qr.save(assets / "qr.png", scale=16, border=4, dark="#05070a", light="#ffffff")

    config_path = ROOT / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["share"] = {"url": url}
    config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    build_config.main()

    print(f"QR for {url}")
    print("Saved assets/qr.svg and assets/qr.png\n")
    qr.terminal(compact=True)


if __name__ == "__main__":
    main()
