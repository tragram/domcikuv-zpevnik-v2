#!/usr/bin/env node
// Runs a single read-only SELECT against the local D1 database. Rejects
// anything that isn't a lone SELECT statement, so it's safe to allowlist
// even with an arbitrary trailing SQL string.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const wranglerBin = path.join(repoRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const dbName = "zpevnik";

const sql = process.argv.slice(2).find((arg) => !arg.startsWith("-"));

if (!sql) {
  console.error('Usage: pnpm run db:query -- "SELECT ..."');
  process.exit(1);
}

const trimmed = sql.trim();

if (!/^select\b/i.test(trimmed)) {
  console.error("Only SELECT statements are allowed.");
  process.exit(1);
}

const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, "");
if (withoutTrailingSemicolon.includes(";")) {
  console.error("Only a single statement is allowed.");
  process.exit(1);
}

try {
  execFileSync(
    process.execPath,
    [wranglerBin, "d1", "execute", dbName, "--local", "--command", trimmed],
    { stdio: "inherit" },
  );
} catch (err) {
  process.exit(err.status ?? 1);
}
