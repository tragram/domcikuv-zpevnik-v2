npx wrangler d1 export zpevnik --remote --no-schema --output scripts/remoteDB.sql
# manually delete d1_migrations from remoteDB.sql
rm -rf .wrangler/state/v3/d1/
pnpm i -D wrangler@3.105 # wrangler has been broken for a year, this version works
pnpm db:generate
pnpm db:migrate:local
npx wrangler d1 execute zpevnik --local --file scripts/remoteDB.sql
pnpm i -D wrangler@4.20.5
