# Architecture — Domcikův Zpěvník v2

A songbook / chord-sheet web app: browse songs, view them with transposable
chords, edit/submit new versions, and optionally "listen along" with someone
else's live session. It runs entirely on Cloudflare's edge stack as **one
deployable unit** — a single Worker serves both the static SPA and its API,
backed by D1, R2, KV, a Durable Object, and a Queue.

```
Browser (React SPA, PWA)
        │
        │ HTTPS / WebSocket
        ▼
┌───────────────────────────── Cloudflare Worker ─────────────────────────────┐
│                                                                              │
│  Static assets (dist/client) ── SPA fallback ──► index.html + JS bundle     │
│  "/api/*"        ── run_worker_first ──►  Hono app (src/worker/index.ts)    │
│  WebSocket upgrade on /api/session/* ──► SessionSync Durable Object         │
│                                                                              │
│   D1 (SQLite via Drizzle)   R2 (assets/illustrations)   KV (songDB version) │
│   Queue (illustration-queue, consumed by the same Worker's queue() handler) │
└──────────────────────────────────────────────────────────────────────────────┘
```

Routing between "serve the SPA" and "run the API" is done purely by
Cloudflare's asset config (`wrangler.jsonc`: `not_found_handling:
"single-page-application"`, `run_worker_first: ["/api/*"]`) — there is no
separate API host, no CORS story, and no reverse proxy to reason about.

---

## 1. Repository layout

```
src/
  lib/        shared code — imported by BOTH worker and web
  worker/     Cloudflare Worker: Hono API, Durable Object, background helpers
  web/        React SPA (routes, features, components, hooks, services)
scripts/      Node/tsx maintenance scripts (backup, sync, seeding, YouTube backfill)
songs/        static snapshot of production content (chordpro, illustrations, PDFs)
drizzle/      generated SQL migrations for D1
.github/workflows/  CI + scheduled data-sync jobs
```

### `src/lib` — shared kernel

Code that must produce identical results on the server and in the browser
(so edits and views agree, and Drizzle types are the single source of truth):

- `db/schema/*` — Drizzle table definitions + relations (see §4).
- `contracts/*` — Zod schemas shared by the Hono routes (server-side
  validation) and the web forms (client-side validation) — one shared
  contract, not two.
- `chordpro.ts`, `chords2chordpro.ts` — ChordPro parsing/generation.
- `auth/client.ts` / `auth/server.ts` — better-auth configuration (see §3).
- `song-ids.ts`, `youtube.ts`, `nickname.ts` — small pure-logic helpers, each
  with a co-located `*.test.ts`.
- `query-client.ts` — the TanStack Query client + IndexedDB persister used by
  the SPA for offline caching (see §6).

---

## 2. Worker / API (`src/worker`)

### Request pipeline

`src/worker/index.ts` builds one Hono app (`buildApp()` in `api/utils.ts`,
typed with `AppEnv` — `Bindings: Env`, `Variables: { SESSION, USER, db }`).
A single global middleware:

1. Instantiates Drizzle against `c.env.DB` and stashes it as `c.var.db`.
2. Calls `better-auth`'s `getSession` and, if valid, sets `c.var.SESSION` /
   `c.var.USER`.
3. Fires-and-forgets a `lastLogin` timestamp update (`waitUntil`, doesn't
   block the request).

A global `app.onError` handler turns `HTTPException`s and `ZodError`s into a
consistent **JSend** envelope (`responses.ts`: `successJSend` / `failJSend`
for expected 4xx / `errorJSend` for 5xx), so individual routes don't each
reimplement error shaping.

Routes are mounted under `/api`:

| Path              | File                          | Responsibility |
|-------------------|-------------------------------|----------------|
| `/auth/*`         | `api/auth.ts`                 | better-auth handler (Google/GitHub OAuth + email/password) |
| `/songs/*`        | `api/songDB.ts`                | song list (full + incremental), single-song fetch, songbooks, illustrations/prompts, delegates `/songs/external/*` to `api/external.ts` |
| `/favorites/*`    | `api/favorites.ts`             | per-user songbook (favorite + pin + personal key/capo) |
| `/editor/*`       | `api/editor.ts`                | create/update song versions, AI chord autofill, submission history |
| `/youtube/*`      | `api/youtube.ts`               | YouTube metadata lookups |
| `/profile/*`      | `api/userProfile.ts`           | user profile (nickname, public songbook toggle, etc.) |
| `/admin/*`        | `api/admin/*.ts`                | moderation: songs, users, illustrations, illustration prompts |
| `/illustrations/*`| `api/admin/illustrations.ts`   | AI illustration generation, gated by `adminOrTrustedMiddleware`; also the Queue consumer entry point |
| `/session/*`      | `api/sessions.ts`              | HTTP bridge into the `SessionSync` Durable Object (WebSocket upgrade + REST snapshot) |

Authorization is layered as **middleware**, not scattered checks:
`trustedUserMiddleware` / `adminOrTrustedMiddleware` (`api/utils.ts`,
`api/admin/admin.ts`) gate whole route groups; individual handlers still
re-check ownership (e.g. "users can only delete their own pending version")
where the rule is per-row rather than per-route.

### Songs & the editing/versioning workflow

`song` is a stable identity; all content lives in `songVersion` rows with a
status machine:

```
pending ──(approve)──► published ──(new published version)──► archived
   │                                                              
   └──(reject)──► rejected                     (any status) ──► deleted
```

- `song.currentVersionId` points at the version clients should render.
- A submission by a non-trusted user creates a `pending` version; a trusted
  user's or admin's edit publishes directly (`editor.ts` checks
  `user.isTrusted` / `isAdmin` before calling `createSongVersion`).
- On submit, the submitter's own songbook is pinned to their new version
  (`favorite-helpers.setSongbookEntry`) so their in-progress edit shows in
  *their* view immediately regardless of approval state — but doesn't leak
  into other users' feeds until approved.
- `songImport` records external-source lineage (scraped from `cifraclub`,
  `pisnicky-akordy`, `zpevnik-skorepova` — see `worker/helpers/external-search/`)
  so an imported song can be traced back to its source.
- Illustrations follow the same "immutable record + current pointer" shape:
  `illustrationPrompt` (AI-generated summary text) → `songIllustration`
  (generated image + thumbnail), with `song.currentIllustrationId` selecting
  the active one. Generation is queued (`ILLUSTRATION_QUEUE`) rather than
  synchronous — `worker/index.ts`'s exported `queue()` handler calls
  `coreGenerateIllustration` for each message and acks/retries individually.

### Live "listen-along" sessions — the `SessionSync` Durable Object

This is the most intricate part of the backend
(`src/worker/durable-objects/SessionSync.ts`). One Durable Object instance
per session; a "master" browser tab pushes song/transpose state, and any
number of "follower" tabs receive it over WebSocket.

```
 Master tab                SessionSync DO                 Follower tab(s)
 ──────────                ──────────────                 ───────────────
 connect ws?role=master ─► accepts, closes any prior
                            master (sends master-replaced)
 update-song ───────────►  validate sender == current master
                            persist state + debounced D1 write
                            broadcast "sync" ─────────────► apply song/transpose
                            reply "update-ok" (audience)
                        ◄── relay-subtree (if a follower is
                            itself relaying to sub-followers)
 client-count (periodic
   liveness sweep) ◄──────  alarm() re-sweeps every 60s
```

Notable design points:

- **Hibernatable WebSockets** — the DO uses `ctx.acceptWebSocket` +
  `serializeAttachment`/`deserializeAttachment` so socket metadata survives
  the DO going to sleep between messages; no in-memory-only state that a
  hibernation cycle could lose (session state is also persisted to
  `ctx.storage`).
- **Ghost detection without relying on close events** — Cloudflare
  auto-responds to client pings without waking the DO
  (`setWebSocketAutoResponse`), and records a per-socket last-ping
  timestamp. A socket is considered dead if unseen for `STALE_AFTER_MS`
  (~2 missed 90s heartbeats); a periodic `alarm()` sweep (`SWEEP_INTERVAL_MS`
  = 60s) recounts and self-corrects even if no explicit close/leave ever
  arrives (e.g. a laptop closed mid-session).
- **Relay chains** — a follower can itself act as a relay to its own
  sub-followers (`useMasterRelay` on the client side); the DO tracks each
  relaying follower's reported `subtree` of client ids so the audience count
  is by *distinct client identity*, not a naive sum (a client reachable both
  directly and via a relay is counted once). Cycle detection
  (`loop-detected`) cascades a warning down the whole chain.
- **Debounced D1 writes** — every song change doesn't hit D1; writes to the
  `syncSession` history table are debounced 5s (except the very first song
  of a session and the "stopped relaying" transition, which flush
  immediately) so rapid transpose/song changes don't flood the database.
  Relayed (non-first-party) updates never write to D1 at all, so a
  follower-of-a-follower doesn't pollute the "who's listening to what" list.

---

## 3. Auth

`better-auth` (`src/lib/auth/server.ts`), backed by the same D1/Drizzle
instance via `drizzleAdapter`. Supports email/password plus Google and GitHub
OAuth. The `user` table carries app-specific fields alongside the auth
essentials: `nickname`, `isFavoritesPublic`, `isAdmin`, `isTrusted`.
`isTrusted` gates auto-publish-on-edit and AI autofill; `isAdmin` gates the
admin dashboard and moderation actions. `src/lib/auth/client.ts` is the
matching browser-side client used by the login/signup/profile routes.

---

## 4. Data model (`src/lib/db/schema`)

```
 user ──< songVersion (author)         user ──< favorites ──> song
   │                                              (songbook entry: pin +
   ├──< account, session, verification            personal key/capo override)
   │      (better-auth tables)
   │
   └──< syncSession (history of "listen-along" sessions, written by the DO)

 song ──< songVersion ──> songImport (optional external-source lineage)
   │  \
   │   └─ currentVersionId (which version is "live")
   │
   └──< songIllustration ──> illustrationPrompt
        (song.currentIllustrationId picks the active illustration)
```

Everything money/content-shaped is soft-deleted (`deleted: boolean`) rather
than actually removed, and most tables carry `createdAt`/`updatedAt` —
consistent with the "never lose a user's submission" design goal visible in
the editor flow.

---

## 5. Frontend (`src/web`)

### Routing

TanStack Router, file-based under `routes/`, with a generated
`routeTree.gen.ts` giving fully-typed navigation/params. Notable route groups:

- `song/$songId` — the main song view.
- `feed/$masterNickname` — join someone's live session by nickname.
- `edit/$songId`, `edit/index` — editor for an existing / new song.
- `(auth)/login|signup|profile|submissions` — auth-gated pages.
- `admin`, `gallery`, `import` — moderation, illustration browsing, external
  song import.

The router context carries `queryClient` and a typed `api` client
(`main.tsx`), so every route loader has both available without prop drilling.

### Server ↔ client type-sharing without leakage

`src/worker/api-client.ts` builds a Hono RPC client:

```ts
import type { route } from "./index";   // TYPE-ONLY import
const client = hc<typeof route>("/");
```

Because it imports only the *type* of the Hono app, the browser bundle gets
full end-to-end type safety for every route's params/response shape without
pulling in server-only SDKs (OpenAI, `@google/genai`, octokit, the S3 client)
that the worker code imports — those never end up in client JS.

`src/web/services/*-service.ts` wrap this client per domain (song, editor,
favorites, admin, illustrations, user) and are the only place UI code talks
to the network; features call services, not the raw client.

### Offline-first data layer

`src/lib/query-client.ts` configures TanStack Query with
`networkMode: "offlineFirst"`, `gcTime: Infinity`, and a single failed
retry (fail fast → fall back to cache), then persists the cache to
IndexedDB (`idb-keyval`) with `maxAge: Infinity` + a manually-bumped
`CACHE_BUSTER` string (bump it by hand when a breaking cache-shape change
ships). `cacheRestored` is a promise the router's root route awaits before
running loaders — but app-shell rendering itself is *not* gated on it, so a
cold offline load still paints immediately instead of hanging on IndexedDB.
A 5s timeout race prevents a stalled IndexedDB read from blanking the UI
forever.

### Feature slices (`features/`)

Each feature owns its components, hooks, and utils together rather than
splitting by technical layer:

- **SongList** — browse/search (Fuse.js) + filter toolbar (language, capo,
  vocal range, songbook) + sort.
- **SongView** — the core rendering surface:
  - `utils/` — ChordPro → renderable structure, transpose math, column
    layout, font sizing.
  - `hooks/useSongTranspose.ts` — per-user pinned key/capo logic (capo never
    re-spells chords, only shifts the sounding pitch — see project memory
    `songbook-personalization`).
  - `hooks/useSessionSync.ts` / `useMasterRelay.ts` — the client side of the
    `SessionSync` protocol described in §2, including reconnect/backoff and
    relay bridging.
- **Editor** — CodeMirror-based ChordPro editor, live preview
  (`react-codemirror-merge` for diffing), metadata form, AI autofill trigger,
  YouTube field.
- **Gallery** — illustration browsing grid.
- **AdminDashboard** — tables + forms for moderating songs, users,
  illustrations, and illustration prompts.

### PWA / offline shell

`src/web/sw.ts` is a Workbox-based service worker (precaching + runtime
caching), paired with `OfflineIndicator` and `usePWAInstall` for the
install-prompt UX. This is layered *underneath* the TanStack Query offline
cache described above — the SW caches the app shell/assets, Query/IndexedDB
caches the data.

---

## 6. Content pipeline & scripts (`scripts/`, `songs/`)

Production content doesn't only live in D1 — it's mirrored into the repo as
static files under `songs/` (chordpro, illustrations, PDFs, scraped source
snapshots), and that mirror is what actually ships in the client bundle for
fully-offline use. Two scheduled GitHub Actions keep the two in sync:

- **`sync.yml`** (nightly, 04:00 UTC) — `scripts/sync.ts` backs up the full
  D1 database to R2 as JSON (skipping ephemeral tables like `session` and
  `syncSession`), regenerates thumbnails
  (`scripts/generate-thumbnails.mjs`), and opens/updates a standing
  `data-sync` PR containing only the `songs/` diff. Merging that PR updates
  the *repository snapshot*; production D1 is unaffected until the next
  deploy.
- **`sync-cleanup.yml`** — `scripts/post-sync-cleanup.ts` runs after a sync
  PR is merged+deployed: flips illustration URLs in D1 over to the new
  static paths and moves the now-unreferenced R2 originals to trash.
- **`generate-thumbnails.yml`** — thumbnail generation on its own schedule
  independent of the full sync.
- **`ci.yml`** — on every push/PR to `main`: install deps, `pnpm test`
  (Vitest). No separate lint/typecheck job is wired into CI currently —
  those are run locally (`pnpm lint`, `pnpm typecheck`).

Other one-off / maintenance scripts: `restoreBackupToLocal.ts` (pull a prod
R2 backup into the local D1 for dev), `staticData2DB.ts` (seed local D1 from
`songs/`), `db-query.mjs` (ad hoc D1 queries), `youtube-backfill/*` (fetch →
manual review server → push pipeline for backfilling YouTube ids),
`favorites-capo/*` (backup/apply migration helpers for the personal capo
feature).

---

## 7. Build & deploy

- **Dev**: `vite` dev server, Cloudflare's Vite plugin (`@cloudflare/vite-plugin`)
  running the Worker code in-process so `/api/*` behaves like production.
- **Build**: `vite build` → `dist/client` (the SPA assets Wrangler serves).
- **Check**: `tsc -b && vite build && wrangler deploy --dry-run` — a deploy
  is only ever attempted after a full build succeeds.
- **Deploy**: `pnpm run build && wrangler deploy` — ships the SPA assets and
  the Worker (incl. D1 bindings, R2, KV, the `SessionSync` DO migration, and
  the illustration queue) as one unit.
- **DB migrations**: Drizzle Kit generates SQL under `drizzle/`; applied via
  `wrangler d1 migrations apply` (local or remote) rather than
  `drizzle-kit push`, so schema changes are reviewable, ordered files.

---

## 8. A few cross-cutting design choices worth knowing up front

- **One Worker, no API gateway** — asset routing config decides SPA vs API,
  not application code.
- **JSend everywhere** — every API response is `{status: success|fail|error, ...}`,
  handled centrally so individual routes stay terse.
- **Two independent offline layers** — Workbox for the app shell, TanStack
  Query + IndexedDB for data — deliberately never merged into one cache.
- **Type-only cross-boundary imports** — the pattern used for
  `worker/api-client.ts` (import types, never values, across the
  worker/web boundary) is what keeps server-only dependencies out of the
  client bundle; worth following for any new cross-boundary type sharing.
- **Immutable-record + current-pointer** shape repeated across the schema
  (`song.currentVersionId`, `song.currentIllustrationId`) rather than
  mutating rows in place — preserves history/audit trail for free.
