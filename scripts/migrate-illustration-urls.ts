import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { and, eq, like, or } from "drizzle-orm";
import { songIllustration } from "../src/lib/db/schema";
import { canonicalIllustrationPath, legacyIllustrationPrefix, staticIllustrationPath } from "./shared/illustration-paths";
import { segment } from "./shared/song-snapshot";

function canonicalPath(url: string, kind: "full" | "thumbnail") {
  const target = canonicalIllustrationPath(url);
  const match = staticIllustrationPath.exec(target);
  if (!match || match[3] !== kind || ![match[1], match[2], match[4]].every(part => segment.safeParse(part).success)) {
    return undefined;
  }
  return target;
}

function localFile(url: string) {
  return fileURLToPath(new URL(`..${url}`, import.meta.url).href);
}

async function checkDeployed(url: string, origin: string) {
  const response = await fetch(new URL(url, origin), {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status !== 200 || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "image/webp") {
    await response.body?.cancel();
    throw new Error(`Expected a WebP image, got HTTP ${response.status}`);
  }
  const actual = Buffer.from(await response.arrayBuffer());
  if (!actual.equals(await fs.readFile(localFile(url)))) throw new Error("Bytes differ from the checkout");
}

async function main() {
  const [flag, extra] = process.argv.slice(2);
  const usage = "Usage: pnpm exec tsx scripts/migrate-illustration-urls.ts [--dry-run | --apply]";
  if (extra || (flag && !["--dry-run", "--apply", "--help"].includes(flag))) throw new Error(usage);
  if (flag === "--help") {
    console.log(usage);
    console.log("Apply after production serves the canonical paths and sync and cleanup recognize them.");
    return;
  }
  const apply = flag === "--apply";
  const { db } = await import("./shared/remote-db");
  const origin = new URL(process.env.PROD_BASE_URL || "https://zpevnik.hodan.page").origin;
  const rows = await db.select({
    id: songIllustration.id,
    imageURL: songIllustration.imageURL,
    thumbnailURL: songIllustration.thumbnailURL,
    updatedAt: songIllustration.updatedAt,
  }).from(songIllustration).where(and(
    eq(songIllustration.deleted, false),
    or(
      like(songIllustration.imageURL, `${legacyIllustrationPrefix}%`),
      like(songIllustration.thumbnailURL, `${legacyIllustrationPrefix}%`),
    ),
  )).orderBy(songIllustration.id);

  const changes = rows.map(row => {
    const imageURL = canonicalPath(row.imageURL, "full");
    const thumbnailURL = canonicalPath(row.thumbnailURL, "thumbnail");
    const mate = imageURL?.replace(/\/full\/([^/]+)$/, "/thumbnail/$1");
    if (!imageURL || !thumbnailURL || thumbnailURL !== mate) {
      throw new Error(`Unexpected illustration URL pair for ${row.id}: ${row.imageURL} / ${row.thumbnailURL}`);
    }
    return { row, imageURL, thumbnailURL };
  });
  const paths = [...new Set(changes.flatMap(change => [change.imageURL, change.thumbnailURL]))];
  console.log(`${apply ? "Apply" : "Dry run"} for D1 ${process.env.CF_DATABASE_ID}: ${changes.length} illustration rows, ${paths.length} distinct asset URLs at ${origin}.`);
  for (const { row, imageURL } of changes.slice(0, 5)) console.log(`  ${row.imageURL} → ${imageURL}`);
  if (!changes.length) return;

  // Finish asset checks for the entire migration before the first D1 write.
  const failures: string[] = [];
  for (let i = 0; i < paths.length; i += 12) {
    const batch = paths.slice(i, i + 12);
    const results = await Promise.allSettled(batch.map(async url => {
      if (!(await fs.stat(localFile(url))).isFile()) throw new Error("Missing local asset");
      if (apply) await checkDeployed(url, origin);
    }));
    results.forEach((result, index) => {
      if (result.status === "rejected") failures.push(`${batch[index]}: ${result.reason}`);
    });
  }
  if (failures.length) {
    for (const message of failures.slice(0, 10)) console.error(message);
    throw new Error(`${failures.length} asset checks failed. No D1 rows were updated.`);
  }
  if (!apply) {
    console.log("All destination files exist in the checkout. --apply also verifies their deployed bytes.");
    return;
  }

  let updated = 0;
  let skipped = 0;
  for (const { row, imageURL, thumbnailURL } of changes) {
    const result = await db.update(songIllustration).set({
      imageURL, thumbnailURL, updatedAt: new Date(),
    }).where(and(
      eq(songIllustration.id, row.id),
      eq(songIllustration.imageURL, row.imageURL),
      eq(songIllustration.thumbnailURL, row.thumbnailURL),
      eq(songIllustration.updatedAt, row.updatedAt),
      eq(songIllustration.deleted, false),
    )).returning({ id: songIllustration.id });
    if (result.length) updated++;
    else {
      skipped++;
      console.error(`Skipped concurrently edited illustration: ${row.id}`);
    }
  }
  console.log(`Updated ${updated} illustration rows. Skipped ${skipped} concurrent edits.`);
  if (skipped) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
