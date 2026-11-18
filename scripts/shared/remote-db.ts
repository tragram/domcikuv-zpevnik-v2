/**
 * Remote D1 connection for one-off scripts, over the Cloudflare HTTP API
 * (same approach as scripts/sync.ts). Handles both reads and writes.
 *
 * Env is read from .dev.vars: CF_ACCOUNT_ID (or CLOUDFLARE_ACCOUNT_ID),
 * CF_DATABASE_ID, CF_API_TOKEN (needs D1 write for any update scripts).
 */
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../../src/lib/db/schema";

import { requireEnv } from "./env";

export { requireEnv };

const CF_ACCOUNT_ID = requireEnv("CF_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID");
const CF_DATABASE_ID = requireEnv("CF_DATABASE_ID");
const CF_API_TOKEN = requireEnv("CF_API_TOKEN");

export const db = drizzle(
  async (sql, params, method) => {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_DATABASE_ID}/query`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });
    if (!response.ok) {
      throw new Error(`D1 query failed: ${response.status} - ${await response.text()}`);
    }
    const data = (await response.json()) as {
      success: boolean;
      errors?: { message: string }[];
      result: { success: boolean; results: Record<string, unknown>[] }[];
    };
    if (!data.success || !data.result?.[0]?.success) {
      throw new Error(`D1 query failed: ${JSON.stringify(data.errors ?? [])}`);
    }
    const results = data.result[0]?.results ?? [];
    // sqlite-proxy expects rows as positional arrays; D1 returns objects whose
    // key order matches the SELECT column order.
    const rows = results.map((row) => Object.values(row));
    return { rows: method === "get" ? rows[0]! : rows };
  },
  { schema },
);

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
