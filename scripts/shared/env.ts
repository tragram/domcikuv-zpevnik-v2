/**
 * Env loading for one-off scripts. Reads .dev.vars (local runs); in CI the
 * variables come from the workflow env instead.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.dev.vars") });

export function requireEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  throw new Error(`Missing required env var (tried: ${names.join(", ")}) in .dev.vars`);
}
