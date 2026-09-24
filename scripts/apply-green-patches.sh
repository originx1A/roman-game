#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Restore App.tsx from existing single-file gzip payload (full app, pre-store-layer tip)
python3 - <<'PY'
import gzip, base64, re, pathlib
p = pathlib.Path('scripts/payload/App.tsx.gz.b64')
b64 = re.sub(r'\s+', '', p.read_text())
data = gzip.decompress(base64.b64decode(b64))
pathlib.Path('src/App.tsx').write_bytes(data)
print('inflated App.tsx', len(data))
PY

# Apply patches onto current tree files (css/comments/sound already on tip; App from inflate)
patch -p1 < scripts/patches/green-app.patch
patch -p1 < scripts/patches/green-appcss.patch
patch -p1 < scripts/patches/green-comments.patch
patch -p1 < scripts/patches/green-sound.patch

python3 - <<'PY'
import hashlib, pathlib
expect = {
  'src/App.tsx': 'd5b8742fe7f8bbf155ec482d32687c16f87f3f5bfab2002728a4d929d9539ae8',
  'src/App.css': 'c848ebf7153eea6f5b23484dcb655afc32b362ff60e470ae481671b220be6342',
  'src/game/comments.ts': '9ab2cf24fcc52788c96f760005b0d8c0c9413adbd81153584219c1530ef78bc5',
  'src/game/sound.ts': '0be6ac7f68151cb2e368feaab75e477402a5bb79befa244c9fd8c65301e12c30',
}
for rel, sha in expect.items():
  got = hashlib.sha256(pathlib.Path(rel).read_bytes()).hexdigest()
  print(rel, got[:12], 'OK' if got==sha else 'FAIL expected '+sha[:12])
  if got != sha:
    raise SystemExit(1)
print('HASHES_OK')
PY
