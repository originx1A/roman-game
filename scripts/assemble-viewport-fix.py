#!/usr/bin/env python3
from pathlib import Path
root = Path(__file__).resolve().parents[1]
parts_dir = root / "src" / "_viewport_parts"
for name in ("App.tsx", "App.css"):
    manifest = (parts_dir / f"{name}.manifest").read_text().splitlines()
    data = "".join((parts_dir / part).read_text() for part in manifest if part.strip())
    (root / "src" / name).write_text(data)
    print(f"assembled {name} ({len(data)} bytes)")
