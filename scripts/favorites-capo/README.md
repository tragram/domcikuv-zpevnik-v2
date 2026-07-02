# Favorites capo seeding

One-off: copy each song's **current capo** into a user's favorites rows, so their
songbook locks in today's capos (e.g. before song-level capos get re-edited via
the YouTube review tool). Capo maps 1:1 (both are absolute frets); key is left
alone because the favorites key is a pitch class, not a chord name.

Env (from `.dev.vars`): `CF_ACCOUNT_ID`/`CLOUDFLARE_ACCOUNT_ID`, `CF_DATABASE_ID`,
`CF_API_TOKEN` (needs **D1 write** for apply).

## 1. Backup (read-only)

```bash
pnpm run capo:backup                          # defaults to domho108@gmail.com
pnpm run capo:backup -- --email=foo@bar.com
```

Writes `capo-backup.json` (git-ignored): every song's current capo, plus a full
snapshot of the user's favorites rows (capo / keyIndex / pin) for rollback.

## 2. Apply

```bash
pnpm run capo:apply                  # dry run — shows what would change
pnpm run capo:apply -- --apply       # write to the remote DB
pnpm run capo:apply -- --apply --overwrite   # also replace existing overrides
```

For each favorite, sets `favorites.capo` to the song's current capo. Requires the
backup file to exist first. By default favorites that **already** have a capo
override are left untouched (use `--overwrite` to force them too); songs with no
capo are skipped.
