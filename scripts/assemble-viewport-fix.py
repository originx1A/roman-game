#!/usr/bin/env python3
import base64
from pathlib import Path
root = Path(__file__).resolve().parents[1]
parts_dir = root / "src" / "_viewport_parts"
for name in ("App.tsx", "App.css"):
    manifest = (parts_dir / f"{name}.manifest").read_text().splitlines()
    chunks = []
    for part in manifest:
        part = part.strip()
        if not part:
            continue
        chunks.append(base64.b64decode((parts_dir / part).read_text().strip()))
    data = b"".join(chunks)
    (root / "src" / name).write_bytes(data)
    print(f"assembled {name} ({len(data)} bytes)")
