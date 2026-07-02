# YouTube link backfill

A three-step workflow to populate `song_version.youtube_id` (and tidy up `key` /
`capo`) for the existing song catalogue: auto-search candidates, review them by
hand in the browser, then push the changes to the remote DB.

All state lives in a single local file, `youtube-links.json` (git-ignored), so
the process is fully resumable and nothing is written to the DB until you say so.

Env is read from `.dev.vars`: `CF_ACCOUNT_ID` (or `CLOUDFLARE_ACCOUNT_ID`),
`CF_DATABASE_ID`, `CF_API_TOKEN` (needs **D1 read for fetch, D1 write for push**).
No YouTube API key is needed — search scrapes the public results page.

## 1. Fetch + auto-search

```bash
pnpm run yt:fetch
```

Reads every current song from the **remote** DB and finds the first matching
video for any song that doesn't already have a link, by **scraping the public
YouTube results page** (no Data API key, no quota — the Data API's `search.list`
caps at ~100 songs/day, far too little for the whole catalogue). Writes
`youtube-links.json`.

- **Read-only** against the DB.
- **Resumable:** the full migrated catalogue is written before searching, so an
  interrupt leaves a complete file; already-searched songs are never re-searched.
- If YouTube starts returning **429s** (IP rate-limit), the run stops and saves —
  wait a bit and re-run.
- Scraping is **unofficial** and can break if YouTube changes its page markup.

## 2. Review in the browser

```bash
pnpm run yt:review
```

Opens a local site at <http://localhost:4321>. Work through the **Pending** list:

Each song has three **independently saved** fields — **Video**, **Key**, **Capo**:

- Click a thumbnail to play the video inline; use **search YouTube** if the
  auto-pick is wrong and paste a better link/id. **Save** commits it (an empty
  box = "no video"); **↺** clears it back to tracking the DB.
- Edit **Key** / **Capo** and hit their **Save** buttons (only enter the ones you
  want to change; changed values are highlighted).

Only **saved** fields are ever pushed. Anything left **unsaved** keeps tracking
the DB and is refreshed from fresh DB data on the next `yt:fetch`. Every Save is
written to `youtube-links.json` immediately.

## 3. Push to the remote DB

```bash
pnpm run yt:push            # dry run — shows what would change
pnpm run yt:push -- --apply # actually writes to the REMOTE DB
```

Writes to each song's **current version** row, considering **only saved fields**
and **only where they differ** from fresh DB values (re-read at push time, so a
song edited since the fetch is never clobbered on a stale version).

When the **key** changes, the inline chords are **transposed** to the new key
(using the app's own chord logic), and `range` / `startMelody` are transposed to
match. The source key is the current DB key, or a best-effort guess from the
first chord; if neither is available the key label is updated but the chords are
left as-is (flagged in the preview).
