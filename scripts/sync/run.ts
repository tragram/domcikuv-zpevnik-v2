import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { normalizeStaticImages } from "./images.mjs";
import {
  automaticSync, generatedPath, inventory, checkChanges, validateSnapshot,
  deploymentResult, type BuildCheck,
} from "./safeguards";

// One entry point for the workflow's publishing and deployment phases.
// Validation can also be run locally; publishing is restricted to Actions.
async function validate() {
  const base = process.env.SYNC_BASE_SHA || "HEAD";
  if (!/^(HEAD|[a-f0-9]{40})$/.test(base)) throw new Error("Invalid sync base revision");
  const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).split("\0").filter(Boolean);
  const before = git("ls-tree", "-r", "--name-only", "-z", base, "--", "songs/");
  const changed = [...new Set([
    ...git("diff", "--name-only", "--no-renames", "-z", base, "--"),
    ...git("ls-files", "--others", "--exclude-standard", "-z"),
  ])];
  const files = inventory(process.cwd());
  const deletions = checkChanges(before, files, changed, process.env.ALLOW_LARGE_DELETIONS === "true");
  const result = await validateSnapshot(process.cwd(), files, changed);
  const report = JSON.stringify({ ...result, changedFiles: changed.length, deletions }, null, 2);
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Snapshot validation passed:\n\n\`\`\`json\n${report}\n\`\`\`\n`);
  }
}

async function publish() {
  // This entry point deliberately switches revisions and commits. It is only for
  // the disposable Actions checkout, never an interactive development checkout.
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.RUNNER_OS !== "Linux" || !process.env.GITHUB_OUTPUT) {
    throw new Error("Automatic publishing can only run in the Linux GitHub Actions checkout");
  }
  const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();
  const root = git("rev-parse", "--show-toplevel");
  if (path.resolve(root) !== process.cwd() || git("status", "--porcelain")) throw new Error("Sync requires a clean repository root");
  const run = (...args: string[]) => { execFileSync("pnpm", args, { stdio: "inherit", env: process.env }); };
  const summary = (message: string) => {
    console.log(message);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
  };
  const latest = async () => {
    git("fetch", "origin", "main");
    return git("rev-parse", "origin/main");
  };

  try {
    const sha = await automaticSync({
      async prepare() {
        const base = await latest();
        git("switch", "--detach", base);
        inventory(root); // Reject symlinks before the exporter can follow them.
        run("install", "--frozen-lockfile");
        process.env.SYNC_BASE_SHA = base;
        summary(`Validating a fresh production snapshot against main ${base}.`);
        return base;
      },
      async export() {
        run("exec", "tsx", "scripts/sync.ts");
        console.log("Static WebP normalization:", await normalizeStaticImages());
      },
      async validate() {
        await validate();
        return !!(git("diff", "--name-only", "HEAD") || git("ls-files", "--others", "--exclude-standard"));
      },
      async testAndBuild() {
        run("exec", "vitest", "run");
        run("run", "typecheck");
        run("exec", "tsc", "-p", "scripts/sync/tsconfig.json");
        run("run", "build");
        // Tests/build must not introduce changes outside the data allowlist.
        await validate();
      },
      latest,
      async commit() {
        git("config", "user.name", "github-actions[bot]");
        git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
        git("add", "--", "songs/");
        const staged = git("diff", "--cached", "--name-only", "--no-renames", "-z").split("\0").filter(Boolean);
        if (!staged.length || staged.some(file => !generatedPath(file))) throw new Error("Invalid staged sync paths");
        git("commit", "-m", "chore: automated database and assets sync");
        return git("rev-parse", "HEAD");
      },
      async push() { git("push", "origin", "HEAD:refs/heads/main"); },
      async discard() {
        // Only discard generated songs/ changes in this disposable checkout.
        const untracked = git("ls-files", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean);
        if (untracked.some(file => !generatedPath(file))) throw new Error("Unexpected files prevent retry");
        git("restore", "--source=HEAD", "--staged", "--worktree", "--", "songs/");
        for (const file of untracked) fs.unlinkSync(path.join(root, file));
        summary("Main advanced; discarded generated changes and restarting all validation from current main.");
      },
    });
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `sha=${sha ?? ""}\n`);
    summary(sha ? `Published validated songs/ snapshot: ${sha}. Waiting for Cloudflare deployment.` : "Snapshot unchanged; no commit or deployment needed.");
  } catch (error) {
    summary(`Sync stopped: ${error instanceof Error ? error.message : String(error)}. Inspect the failed step before rerunning.`);
    throw error;
  }
}

async function waitForDeployment() {
  const sha = process.env.SYNC_COMMIT_SHA ?? "";
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const token = process.env.GH_TOKEN;
  if (!/^[a-f0-9]{40}$/.test(sha) || !/^[\w.-]+\/[\w.-]+$/.test(repository) || !token) throw new Error("Missing deployment check configuration");
  const name = process.env.CLOUDFLARE_BUILD_CHECK || "Workers Builds: domcikuv-zpevnik-v2";
  const deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline) {
    const response = await fetch(`https://api.github.com/repos/${repository}/commits/${sha}/check-runs?per_page=100&filter=latest`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Cannot read deployment checks: HTTP ${response.status}`);
    const data = await response.json() as { check_runs: BuildCheck[] };
    if (deploymentResult(data.check_runs, sha, name) === "success") {
      const message = `Cloudflare successfully deployed sync commit ${sha}.`;
      console.log(message);
      if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
      return;
    }
    await setTimeout(15_000);
  }
  throw new Error(`No successful Cloudflare deployment for ${sha} within 20 minutes. Check Workers Builds, its main-branch watch paths, and the ${name} check. R2 originals remain protected by production verification.`);
}

switch (process.argv[2]) {
  case "normalize": console.log(await normalizeStaticImages()); break;
  case "publish": await publish(); break;
  case "wait": await waitForDeployment(); break;
  case "validate": await validate(); break;
  default: throw new Error("Usage: tsx scripts/sync/run.ts publish|wait|validate|normalize");
}
