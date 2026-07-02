#!/usr/bin/env node
// Lints specific files without the risk of forwarding arbitrary eslint flags
// (e.g. --fix) through to a shell. Any argument that looks like a flag is dropped.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const eslintBin = path.join(repoRoot, "node_modules", "eslint", "bin", "eslint.js");

const files = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));

if (files.length === 0) {
  console.error("Usage: pnpm run lint:files -- <file...>");
  process.exit(1);
}

try {
  execFileSync(process.execPath, [eslintBin, ...files], { stdio: "inherit" });
} catch (err) {
  process.exit(err.status ?? 1);
}
