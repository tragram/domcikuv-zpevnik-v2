import type { Config } from "drizzle-kit";
import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";

const crawledDbHelper = D1Helper.get("DB");

const {
  LOCAL_DB_PATH,
  CLOUDFLARE_DATABASE_ID,
  CLOUDFLARE_TOKEN,
  CLOUDFLARE_ACCOUNT_ID,
} = process.env;

export default LOCAL_DB_PATH
  ? ({
      dialect: "sqlite",
      dbCredentials: {
        url: crawledDbHelper.sqliteLocalFileCredentials.url,
      },
    } satisfies Config)
  : ({
      schema: "./src/lib/db/schema/index.ts",
      out: "./drizzle",
      dialect: "sqlite",
      driver: "d1-http",
      dbCredentials: {
        databaseId: CLOUDFLARE_DATABASE_ID!,
        token: CLOUDFLARE_TOKEN!,
        accountId: CLOUDFLARE_ACCOUNT_ID!,
      },
    } satisfies Config);
