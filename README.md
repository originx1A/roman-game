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

## Roman's World News (Kit)

The morning edition is the static site at [romansgame.com/news](https://romansgame.com/news/). This repo does not contain a story pool or a 9:07 publisher. Posts there are hand-built HTML deployed together. As of 2026-10-18 the index had two posts, both dated 2026-10-15, with no used-flag and no queue. The RSS feed and the Kit broadcast read that published index, so a new deploy shows up without a second copy of the stories.

There is an optional pool in Netlify Blobs (`story-pool`). It is empty unless someone writes one. If it exists, the next story is the oldest unused (`addedAt`, then id). A story with `usedOn` set is never selected again. When fewer than 14 unused stories remain, the morning job emails support@romansgame.com once that Toronto day (needs `RESEND_API_KEY` and a production deploy).

`/news/feed.xml` is RSS 2.0 from that index. `/news/` includes `<link rel="alternate" type="application/rss+xml" href="/news/feed.xml">`. Item `guid` is the story slug (`isPermaLink="false"`). `pubDate` is 09:07 America/Toronto on the card's date, written in UTC. The rewrite lives in `public/_redirects`, ahead of `/* /index.html 200`. Netlify applies that file before `netlify.toml`, so a feed rule only in the toml is skipped and the game shell is served instead.

The scheduled function `kit-daily-news` runs at 13:20 and 14:20 UTC. It sends only when the Toronto clock is 09:20 or later in the 9 o'clock hour, so one of those two runs acts in both EDT and EST, including the March and November changeover days. It sends today's newest published story to Kit. If that date has no story, it logs and exits.

The Kit subject is that card's `<h2>` text. The publisher sometimes leaves the YAML or JSON quotes on the heading (`"Throne Weather — …"`). One matching wrapping pair — straight `"` or `'`, or curly `“…”` / `‘…’` — is removed from the subject and the thumbnail alt. Quotes inside the title stay. To keep a wrapping pair, set `data-keep-quotes="true"` (`1`, `yes`, `on`, or the bare attribute) on the `<h2>`, or write the wrapping quotes escaped (`\"Title\"` or `\'Title\'`). Escaped quotes inside a title become real quotes, so `"Say \"hi\""` is sent as `Say "hi"`.

Kit v4 broadcasts can target a **segment or a tag**, not a form id. Set `KIT_SEGMENT_ID` to a segment of form 10053148 when you have one. Until then the broadcast uses the tag `form-10053148`, which this server applies when it adds someone to the form. The marketing-site signup bar posts straight to Kit and is not in this repo. Give Kit a webhook to `POST /api/kit-webhook` with header `X-Kit-Webhook-Secret` so those subscribers get the same tag and welcome.

Amazon Associates forbids affiliate links in email. The daily broadcast, the welcome letter, and support alerts drop every `amazon.*`, `amzn.to`, and `a.co` URL (tagged or not). In the broadcast those links are rewritten to that post's `https://romansgame.com/news/` article. The welcome and the alerts have no article, so the link is removed and the sentence stays. The RSS feed and the pages on romansgame.com are left as published. Sends stay off until `KIT_SEND_ENABLED` is set on a production deploy.

Kit's free plan has broadcasts, not a one-person send (sequences and visual automations are paid). The welcome letter is sent with Resend from support@romansgame.com. The draft copy is `netlify/lib/welcomeCopy.ts`. It is one-time per address (a Blobs record plus the Kit tag `welcome-sent`). The letter includes a one-click unsubscribe link, `List-Unsubscribe` and `List-Unsubscribe-Post` headers, and a mailing-address line. That link cancels the subscriber in Kit and records the address so no further welcome is sent. A later signup is new consent and puts them back on the form, without a second welcome. Kit broadcasts keep `{{ unsubscribe_url }}` and `{{ address }}` so Kit's own footer still works.

Real broadcasts and the welcome letter happen only when `KIT_SEND_ENABLED` is true and the function is running in a production deploy. Kit subscribe, unsubscribe, and support alerts use that same production check. Netlify sets `CONTEXT` for the build, not when a function runs, so the function uses the deploy context from its runtime `Context` (`context.deploy.context`). The site build also bakes that same `CONTEXT` into the bundle for the case where the runtime value is missing. Deploy previews, branch deploys, and local dev never send. `KIT_DRY_RUN=true` or `?dryRun=1` builds the payload and does not send.

### Environment

| Name | Purpose |
| --- | --- |
| `KIT_API_KEY` | Kit v4 key. Read only from this variable. Tony adds it in Netlify. |
| `KIT_SEND_ENABLED` | `true` / `1` / `yes` / `on` allows real sends. Unset or anything else does not. |
| `KIT_DRY_RUN` | `true` logs the payload and does not send. |
| `KIT_ADMIN_SECRET` | Required header `X-Kit-Admin-Secret` for send-now. Compared in constant time. |
| `KIT_FORM_ID` | `10053148` |
| `RESEND_API_KEY` | Welcome mail and failure / low-stock alerts to support@romansgame.com. |
| `NEWS_POSTAL_ADDRESS` | Physical mailing address printed on the Resend welcome (CASL / CAN-SPAM). Welcome mail is not sent while this is empty. |
| `KIT_SEGMENT_ID` | Optional segment id whose members are form 10053148. Preferred broadcast target. |
| `KIT_WEBHOOK_SECRET` | Header `X-Kit-Webhook-Secret` for `POST /api/kit-webhook`. |

### Dry run

Open the scheduled function with `?dryRun=1`, or:

```bash
curl -X POST "$SITE/api/kit-send-now?dryRun=1" -H "X-Kit-Admin-Secret: $KIT_ADMIN_SECRET"
```

The response and the function log show the payload. Nothing is sent.

### Send now

```bash
curl -X POST "$SITE/api/kit-send-now" -H "X-Kit-Admin-Secret: $KIT_ADMIN_SECRET"
```

That sends today's story once. It does not use the 9 o'clock window, so a missed morning edition can be sent later that same Toronto day. It is idempotent. To send a published story again:

```bash
curl -X POST "$SITE/api/kit-send-now?force=1&storyId=STORY-SLUG" -H "X-Kit-Admin-Secret: $KIT_ADMIN_SECRET"
```

`force=1` does nothing unless a story id is included. A missing or wrong secret is 401.

### Switch it on

1. In Kit, confirm a verified sending address and either create a segment of form 10053148 (`KIT_SEGMENT_ID`) or let the tag `form-10053148` stand in.
2. Set `KIT_API_KEY`, `KIT_ADMIN_SECRET`, `KIT_FORM_ID=10053148`, `RESEND_API_KEY`, `NEWS_POSTAL_ADDRESS`, and `KIT_WEBHOOK_SECRET`.
3. Dry-run send-now and read the log.
4. Set `KIT_SEND_ENABLED=true` on the **production** deploy context only. Previews stay dark even if the flag is copied there, because their deploy context is not `production`. Publishing this code requires a new production deploy; the flag alone does not change a function that is already live.
5. Point a Kit webhook at `https://play.romansgame.com/api/kit-webhook` for the marketing-site form.
