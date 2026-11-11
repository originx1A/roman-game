# Portal editions QA — CrazyGames and Poki

Preparation only. Nothing was deployed, merged to `main`, submitted to either portal, or opted into exclusivity. Ads and payments were not enabled.

## Source provenance

Live `https://play.romansgame.com/` and `https://romans-game.netlify.app/` both serve `build 9.33-a18-halo` with:

- `assets/index-DiJu1TQr.js` SHA-256 `130dc577ad7a683aa5cea17774a883d7eeb0cd57b3c6c95cbcf6d62098e27f6e`
- `assets/index-BufU4fDw.css` SHA-256 `521468b30bbaffc9d141fbb3ef1540c4948a2f109c63d370aa040852f9b12c2e`

A production Vite build of `eaa7d13096f5514e20482618cfa5f5ae27942afa` (`origin/main`, commit message `9.33-a18-halo TEST: board size is layout-driven, not measurement-driven`) reproduced those two files byte for byte before any portal edits. That commit is the authoritative editable source. The local checkout at the start of this work was still on `f9263da` (`9.33-a16`) and was not used.

## Packages

Both ZIPs have `index.html` at the archive root, relative asset paths, and the live title text `for kids and grown-ups`. Audience wording was not rewritten.

| Package | SHA-256 | Bytes | Files | Unpacked |
| --- | --- | --- | --- | --- |
| `/opt/cursor/artifacts/romans-game-crazygames.zip` | `00cccb33e36adac13d11b434c9ab93c866fd5d65e5201a5909bc836b42484ff4` | 17351162 | 583 | 19415177 |
| `/opt/cursor/artifacts/romans-game-poki.zip` | `253a550d20fcd5e4403dd074c34a6231fc594e1f8fe0b7761f24bc73a3d13271` | 17351584 | 583 | 19416176 |

Manifest: `/opt/cursor/artifacts/romans-game-portals-manifest.json`.

CrazyGames no-SDK limit checked against current docs: total size under 50 MB and file count under 1500. Poki package is an actual bundled web build, not an iframe of the live site.

Scanned text in both packages. Absent: Supabase, the publishable key, Google Analytics, Google Fonts, Cloudflare Turnstile, Kit, Stripe, `play.romansgame.com`, `jrny.fun`, `facebook.com/romansgame`, `commercialBreak`, `rewardedBreak`, and the CrazyGames SDK URL. The Poki ZIP's `index.html` references only `https://game-cdn.poki.com/scripts/v2/poki-sdk.js`. The CrazyGames ZIP does not reference that script.

Cinzel and Nunito are self-hosted (latin woff2 only) in the portal bundles. The default `index.html` still loads Google Fonts and the GA snippet.

## What each package keeps and drops

Kept from the current game: placement puzzle, Daily and Remix, Defenders, coins earned by play, local save, voice and art, Reset, and the `9.33-a18-halo` tag.

Current `9.33-a` gameplay does not show Undo, Redo, or Hint buttons. Those controls were already removed on this source. They were not put back. A trusted pointer on the first cell of Dawn applies the current mark (`class` includes `mark`).

Dropped only in the portal builds: cloud login, parent/account signup, the local "Save with email" form, JRNY and romansgame.com and Facebook links, share-out to other sites, bug-report upload, anonymous play pings, and website gift-code fetches. Progress stays in local storage. If storage throws, portal builds swallow the error and keep running; the default build still rethrows.

The default production bundle built from this branch still contains `Visit romansgame`, `supabase.co`, the Google Analytics snippet, and the Google Fonts stylesheet. A desktop screenshot of that build shows **Save my scores** and **Visit romansgame.com**. Screenshot: `/opt/cursor/artifacts/default-home-desktop.png`.

## CrazyGames

Docs read: requirements intro, technical, gameplay, advertisement, FAQ, and the HTML5 SDK intro (`https://docs.crazygames.com/`).

Basic Launch allows a game without the SDK. This package is that no-SDK ZIP, fully local, because an SDK script would be an external request and Full Launch monetization was not authorized. There is no `gameplayStart` event because there is no SDK. Adding one later means loading `https://sdk.crazygames.com/crazygames-sdk-v3.js` and firing gameplay start when play begins. Ads are not integrated. Basic Launch disables CrazyGames ads even if they were. No custom fullscreen control is present. UI is English. Pointer, mouse, and touch use the same board. No separate mobile control scheme exists in the current game, so none was invented.

CrazyGames states the site audience is 13+ and games must be PEGI 12. The live game's own title and description say it is for kids and grown-ups. That fact is left in the package. Whether this game is eligible is unresolved and is an owner decision. This report does not claim eligibility, and exclusivity was not accepted.

Browser smoke (real Chrome, local static server): home and play at 1280×720, 390×844, and 907×510. No promo links in the DOM. Build tag visible. A marked cell was saved and a reload offered Resume. With storage methods forced to throw, the home screen still rendered and play could be opened, with no uncaught exception after the portal storage guard. Requests on the later CrazyGames loads stayed on `127.0.0.1`. Screenshots: `/opt/cursor/artifacts/crazygames-home-1280x720.png`, `crazygames-play-907x510.png`, `crazygames-play-390x844.png`, `crazygames-reload-resume.png`, `crazygames-storage-denied.png`.

## Poki

Docs read: adding your game, requirements, external resources, HTML5 SDK, content and player safety, and the Inspector (`https://developers.poki.com/guide/`).

The package is a bundled build. Official SDK script is in `index.html`. Shipping code calls `init`, `gameLoadingFinished`, `gameplayStart` on a real trusted pointer after the board is up (not on load), and `gameplayStop` when play is left. A headless Chrome run against the real SDK recorded, in order: `init` (the wrapper saw this name twice), `gameLoadingFinished` once, `gameplayStart` once, `gameplayStop` once. That run is not the Poki Inspector and is not an approval.

`commercialBreak` and `rewardedBreak` are not called. Poki's requirements say `commercialBreak` should fire when leaving a pause and returning to play. That call is omitted because monetizing ad calls were not authorized. A later review that requires ad breaks will fail until those calls are approved and added. The play/pause state machine itself is unit-tested without the SDK in `scripts/portal-play-phase.test.ts`. The browser run used the real SDK, not that mock.

Loading the official SDK in this Chrome session also requested `a.poki-cdn.com`, `geo.poki.io`, `ads.poki.com`, and several Google ad hosts. Those requests came from the SDK script, not from game ad calls. The ZIP itself only names `game-cdn.poki.com`. Poki blocks other external requests unless approved. This runtime fan-out is a gap to expect in the Inspector.

Tested viewports included 1031×580, 836×470, and 390×844. The board filled the iframe and stayed playable. Arrow keys and Space do not scroll the parent page unless the event target is a button or field, so keyboard activation of buttons still works. Screenshots: `/opt/cursor/artifacts/poki-home-1031x580.png`, `poki-play-1031x580.png`, `poki-play-390x844.png`, `poki-storage-denied.png`.

Poki's content rules include children. The same kids-and-grown-ups wording is kept. No eligibility or age-classification claim is made.

## Tests

`tsc -b` passes. `npm test`: 270 tests, 259 pass, 11 fail. The failures are the existing source checks on this tree (including a test that still expects build tag `9.33-a16` while the source is `9.33-a18-halo`, plus the older SEO, voice-count, treats, save, and replay checks). Portal unit tests pass. No new failure was added by the portal guards.

## Not done

Not submitted, not approved, no portal accounts, no contracts, no exclusivity, no ad network, no payments, no production Netlify or DNS change, no merge to `main`.
