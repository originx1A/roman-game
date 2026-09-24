#!/usr/bin/env python3
"""Restore App.tsx/App.css from base commit and apply viewport patches."""
from __future__ import annotations

import hashlib
import pathlib
import subprocess
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE_SHA = "efb25a79126a8372565c87c65a4f813a1401b12a"
BASE_URL = f"https://raw.githubusercontent.com/originx1A/roman-game/{BASE_SHA}/src"
EXPECTED = {
    "App.tsx": "e35d5a9d3d29e62c261e0592de58069a6ee1decb717f2269afbfca33f8e228ea",
    "App.css": "131a171018de7333ff859fe33bfec7823abc6d395804b9aaf76f6124d05dd858",
}


def main() -> int:
    for name in ("App.tsx", "App.css"):
        dest = ROOT / "src" / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(f"{BASE_URL}/{name}") as resp:
            dest.write_bytes(resp.read())
        patch = ROOT / "patches" / f"viewport-{name}.patch"
        subprocess.check_call(["patch", "-p1", "--batch", "-i", str(patch)], cwd=ROOT)
        digest = hashlib.sha256(dest.read_bytes()).hexdigest()
        if digest != EXPECTED[name]:
            print(f"ERROR: {name} sha256 {digest} != {EXPECTED[name]}", file=sys.stderr)
            return 1
        print(f"OK {name} {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
