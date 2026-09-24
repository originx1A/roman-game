# Roman's Game

A polished logic placement puzzle you can ship and share.

Place **one stone** in every colored region, every row, and every column. Stones may not touch — not even diagonally.

Made for Roman.

## Features

- 20 handcrafted boards (5×5 → 8×8)
- Device save for scores and in-progress boards
- Email identity for named scores and invites
- Challenge links + optional mailto invites
- Undo / redo / hints with explanations
- Web Audio sound effects + win confetti
- Export / import save JSON
- Mobile-friendly UI

## Run locally

```bash
cd roman-game
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview
```

Output is in `dist/` — static files you can host anywhere.

Vite uses a relative `base: './'` so the same `dist/` works on any static host (root or subdirectory).

## Deploy (share with anyone)

**Live:** https://romans-game.netlify.app

```bash
npm run build
```

Then host `dist/` on any static host:

- **Surge**: `npx surge ./dist roman-game.surge.sh`
- **Netlify** (live site): https://romans-game.netlify.app
- **Cloudflare Pages**: upload `dist/` or connect the git repo
- **GitHub Pages**: publish `dist/` (e.g. `npx gh-pages -d dist`) → `https://<user>.github.io/roman-game/`

Share the live URL, or a challenge link (hash-based — works on any domain).

## How saves work

| Mode | What happens |
|------|----------------|
| Device | Progress in `localStorage` (`roman.*` keys) on this browser |
| Email | Same device save, plus a display name stamped on challenges |
| Export | Download `roman-save.json` and import on another device |

There is no cloud server in this build — scores and challenges are local + shareable links. That keeps it zero-cost and private.

## Challenge flow

1. Open **Challenge**
2. Pick a board, optional friend email + message
3. **Create invite link** (copied to clipboard)
4. Friend opens the link → Accept → plays that board

## Scripts

```bash
node scripts/generate-puzzles.mjs   # regenerate puzzle set
```

## Stack

Vite · React · TypeScript · Web Audio API
