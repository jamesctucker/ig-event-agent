# ig-event-agent — AGENTS.md

Chrome extension (Plasmo) that extracts event info from Instagram saved collections using GPT-4.1 (caption + vision) and appends the results to Google Sheets. Personal single-user extension.

## Stack

- **Framework**: Plasmo 0.88 (Chrome MV3: background service worker + side panel + content script)
- **UI**: Vue 3 (`<script setup>` Composition API) + SCSS, icons via `lucide-vue-next`
- **AI**: DeepSeek official API — `deepseek-flash` (DeepSeek-V4.1-Flash, the only official model with vision), via the OpenAI SDK pointed at `https://api.deepseek.com`. Thinking mode is explicitly disabled (`extra_body.thinking.type = 'disabled'`); JSON-mode responses
- **Integrations**: Instagram private collection API (paginated), Google Sheets API via `chrome.identity` OAuth
- **TypeScript**: `strict: true` — keep it clean. **Vitest**: unit tests live in `tests/`

## Commands

```bash
npm install                       # .npmrc sets ignore-scripts=true + legacy-peer-deps (@parcel/watcher fix)
npm rebuild sharp --ignore-scripts=false   # REQUIRED after install, else plasmo build/dev crash on missing sharp binary
npm run dev                       # plasmo dev — HMR → load build/chrome-mv3-dev in chrome://extensions
npm run build                     # plasmo build → build/chrome-mv3-prod
npm run package                   # plasmo package → distributable zip
npm test                          # vitest run
npm run typecheck                 # tsc --noEmit
```

**Gates before calling work done**: `npm run typecheck` AND `npm test` AND `npm run build` all green. Plain `tsc` does not compile Vue SFC script blocks — only `npm run build` catches `.vue` syntax errors.

## Layout

| Path | Role |
|------|------|
| `sidepanel.vue` | Main UI (~900 lines): date range, extract button, progress, event edit/clear, save |
| `options.vue` | Settings page: OpenAI key + Sheet ID only (Google sign-in is via OAuth prompt, no manual client config) |
| `background/messages/extractEvents.ts` | Extraction orchestrator: paginated fetch → analyze caption + image → merge → return events + failedPosts |
| `background/messages/saveToSheets.ts` | Sheets save handler (reports saved/skipped counts) |
| `background/index.ts` | Service worker: side panel open, legacy DOM-scrape fallback (`scrapePost`) |
| `contents/instagram.ts` | Content script on instagram.com: `getPosts`/`getCollections` DOM fallback |
| `lib/events.ts` | **Shared domain module (pure, tested)**: `EventInfo`, `AnalysisResult`, `isCompleteEvent`, `withCompleteness`, `mergeEventInfo`, `SHEET_HEADERS`, `buildSheetRows`, `splitNewEvents` |
| `lib/ai.ts` | DeepSeek calls (model `deepseek-flash`) returning `AnalysisResult` (`ok` with info vs `error` with kind auth/billing/rate-limit/api/parse — never conflates failure with "no event") |
| `lib/googleSheets.ts` | OAuth + Sheets API wrapper: 401 → `removeCachedAuthToken` → re-auth → retry once; resolves first tab title dynamically; dedups by post URL; initializes headers on first save |
| `lib/storage.ts` | ApiConfig persistence (chrome.storage). Secrets are NOT read from env — see Config / secrets |
| `lib/utils.ts` | `retry` + `sleep` are used; the rest is dead code pending cleanup |
| `types/index.ts` | Legacy types — **imported nowhere**; consolidation into `lib/events.ts` is an open task |
| `tests/events.test.ts` | Vitest suite for the pure domain module (merge priorities, completeness gate, dedup, row mapping) |
| `sustainable_events.csv` | Sample of the target sheet's 8-column structure |

## Domain rules (do not drift)

1. **Dual analysis**: always analyze caption AND image per post, then merge via `mergeEventInfo`. Merge priority: image wins date/start/location; caption wins name/organizer/summary; either for cost.
2. **Completeness**: an event needs specific date + start time + location. The single gate is `isCompleteEvent` in `lib/events.ts` — `analyzeCaption`, `analyzeImage` (via `withCompleteness`), and `mergeEventInfo` all route through it. Anti-hallucination prompt rules in `lib/ai.ts` (no relative dates like "this Sunday", no invented start times) are load-bearing — don't loosen them.
3. **Sheet shape**: 8 columns `Name, URL, Date, Start, Location, Organizer, Cost, Summary` (`SHEET_HEADERS` in `lib/events.ts`) matching `sustainable_events.csv`.
4. **No post-timestamp filtering**: event date ≠ post date; the AI filters by event date against the user's range.
5. **Failure visibility**: a failed analysis (bad key, insufficient balance, rate limit, network) must never look like "no event found." Return `AnalysisResult` error kinds; `extractEvents` aborts the run on `auth`/`billing` errors and reports `failedPosts` separately.

## Fixed footguns (regression reference)

These were found in the 2026-09-18 review (`~/the-garage/artifacts/24-ig-event-agent-review.md`) and are now fixed — keep them fixed:

- **Progress messages killing the run** — all UI progress goes through `notifyUI` in `extractEvents.ts` which swallows "Receiving end does not exist". Never `await chrome.runtime.sendMessage` unguarded in the background worker.
- **OAuth retry loop** — `callGoogleSheetsAPI` calls `chrome.identity.removeCachedAuthToken` before re-acquiring on 401.
- **AI errors as empty results** — `ai.ts` returns `AnalysisResult`; don't collapse errors into `{hasEventInfo:false}`.
- **Single-page collection fetch** — `fetchPostsFromAPI` paginates via `next_max_id` (cap `MAX_FEED_PAGES = 10`).
- **First-save headers** — `saveEventsToGoogleSheets` calls `initializeGoogleSheet()` before appending.
- **Sheet tab renaming** — ranges are built from the resolved first-tab title, not the literal `Sheet1`.
- **Single-source location bypass** — `mergeEventInfo` re-stamps single-source results through `isCompleteEvent`.

## Config / secrets

- Runtime config lives in `chrome.storage` under key `apiConfig` (set via Options page). Secrets are intentionally **not** read from `PLASMO_PUBLIC_*` env vars — Plasmo inlines those into the bundle at build time, shipping your key inside the packaged zip. Never add a `PLASMO_PUBLIC_` fallback for a secret. Non-secret dev defaults (e.g. `PLASMO_PUBLIC_GOOGLE_SHEET_ID`) are fine.
- **Extension ID is pinned** via `package.json` → `manifest.key` (public key; private half in `.keys/`, gitignored): `nkogdebkolhahnmhgoeciohcifhflejj`. Pinning keeps the ID stable across dev/prod builds, paths, and machines — do not remove the `key` or every Google OAuth registration breaks.
- **Google OAuth**: `manifest.oauth2.client_id` must be an OAuth client of type **Chrome Extension** with Item ID = the extension ID above. Desktop/Web client types produce `Error 400: invalid_request` from `chrome.identity.getAuthToken`. Scope: `https://www.googleapis.com/auth/spreadsheets`. Consent screen in Testing mode requires the account to be a test user.
- **Browser requirement**: `getAuthToken` depends on Google Chrome's account integration. **Brave and other Chromium forks fail with `Error 400: invalid_request` / "Custom URI scheme is not supported on Chrome apps"** no matter how the client is configured (confirmed 2026-09-18). This is not fixable in extension code — test Google sign-in in Chrome.
- Never commit real keys or sheet IDs. `.env` is gitignored; `.env.example` is the template; `.keys/` holds the extension signing key and is gitignored.

## Docs in this repo

- `README.md` — setup/usage
- `PROJECT_CONTEXT.md` — architecture deep-dive, merge strategy, debugging tips (note: some sections predate the 2026-09 fixes)
- `CODE_REVIEW.md` — 2025-10-27 external review; its 7 fixes are applied
- `EVENT_DATA_STRUCTURE.md` — field-level data docs
- 2026-09-18 re-review + tiered plan: `~/the-garage/artifacts/24-ig-event-agent-review.md`
