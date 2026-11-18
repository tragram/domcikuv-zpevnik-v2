import type { Config } from "drizzle-kit";




const {
  LOCAL_DB_PATH,
  CLOUDFLARE_DATABASE_ID,
  CLOUDFLARE_TOKEN,
  CF_ACCOUNT_ID,
} = process.env;

export default LOCAL_DB_PATH
  ? ({
      dialect: "sqlite",
      dbCredentials: {
        url: LOCAL_DB_PATH,
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
        accountId: CF_ACCOUNT_ID!,
      },
    } satisfies Config);
