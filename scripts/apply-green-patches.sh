#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

python3 - <<'PY'
import gzip, base64, re, pathlib, hashlib

# 1) Inflate App.tsx from existing single-file gzip payload
p = pathlib.Path('scripts/payload/App.tsx.gz.b64')
b64 = re.sub(r'\s+', '', p.read_text())
data = gzip.decompress(base64.b64decode(b64))
pathlib.Path('src/App.tsx').write_bytes(data)
print('inflated App.tsx', len(data))

# 2) Decode patch files from base64 siblings if present
patch_dir = pathlib.Path('scripts/patches')
for b64path in sorted(patch_dir.glob('*.patch.b64')):
    out = pathlib.Path(str(b64path)[:-4])  # remove .b64
    raw = base64.b64decode(re.sub(r'\s+', '', b64path.read_text()))
    out.write_bytes(raw)
    print('decoded', out.name, len(raw))
PY

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
