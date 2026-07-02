/** Shared config for the favorites-capo scripts (no side effects on import). */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BACKUP_PATH = path.resolve(__dirname, "capo-backup.json");
export const DEFAULT_EMAIL = "domho108@gmail.com";

export function targetEmail(): string {
  const arg = process.argv.find((a) => a.startsWith("--email="));
  return arg ? arg.slice("--email=".length) : DEFAULT_EMAIL;
}
