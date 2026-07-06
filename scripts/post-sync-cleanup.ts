/**
 * Post-sync cleanup: for illustrations still pointing at absolute R2 URLs,
 * verify that production already serves the synced static files (full image
 * AND thumbnail), then move the R2 original to trash/ and rewrite the D1 row
 * to the static paths. Images not yet merged/deployed are skipped and picked
 * up by a later run, so this is safe to run at any time.
 *
 * Also prunes old R2 DB backups (30 days of dailies, then one per month).
 */
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { db } from "./shared/remote-db";
import { R2_BUCKET_NAME, s3 } from "./shared/r2";

const PROD_BASE_URL = (
  process.env.PROD_BASE_URL || "https://zpevnik.hodan.page"
).replace(/\/+$/, "");

/** Checks that production actually serves the given path. */
async function servedInProd(pathname: string): Promise<boolean> {
  try {
    const response = await fetch(PROD_BASE_URL + pathname, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log("Starting post-sync cleanup...");
  console.log(`Verifying static files against: ${PROD_BASE_URL}`);

  // 1. Find all illustrations that are absolute URLs AND actually belong to our illustrations folder
  const illustrations = await db.select().from(schema.songIllustration);
  const pendingCleanup = illustrations.filter(
    (ill) =>
      ill.imageURL.startsWith("http") &&
      ill.imageURL.includes("/songs/illustrations/"),
  );

  console.log(
    `Found ${pendingCleanup.length} synced images pending cleanup in the database.`,
    pendingCleanup.map((pc) => pc.imageURL + "\n"),
  );

  for (const ill of pendingCleanup) {
    try {
      // 2. Safely parse out the R2 key from the exact URL in the database
      const parsedImageURL = new URL(ill.imageURL);
      const oldKey = parsedImageURL.pathname.slice(1); // Exact key to move in R2
      const trashKey = `trash/${oldKey}`;

      // 3. Format the final static paths
      let finalImageURL = parsedImageURL.pathname;
      if (!finalImageURL.endsWith(".webp")) finalImageURL += ".webp";

      const finalThumbURL = finalImageURL.replace("/full/", "/thumbnail/");

      // 4. VERIFY PRODUCTION SERVES BOTH STATIC FILES
      // The static paths only work once the sync PR is merged AND deployed;
      // checking prod directly makes the URL flip safe regardless of timing.
      if (!(await servedInProd(finalImageURL))) {
        console.log(`\n[SKIP] ID: ${ill.id}`);
        console.log(`  -> Full image not served by prod yet: ${finalImageURL}`);
        console.log(`  -> Keeping R2 fallback intact.`);
        continue;
      }
      if (!(await servedInProd(finalThumbURL))) {
        console.log(`\n[SKIP] ID: ${ill.id}`);
        console.log(`  -> Thumbnail not served by prod yet: ${finalThumbURL}`);
        console.log(`  -> Keeping R2 fallback intact.`);
        continue;
      }

      console.log(`\n[PROCESSING] ID: ${ill.id}`);

      // 5. Move ONLY the full image to /trash in R2 using the S3 SDK
      await s3.send(
        new CopyObjectCommand({
          Bucket: R2_BUCKET_NAME,
          CopySource: `${R2_BUCKET_NAME}/${oldKey}`,
          Key: trashKey,
        }),
      );

      await s3.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: oldKey,
        }),
      );

      // 6. Update the D1 database to use the newly formatted static paths
      await db
        .update(schema.songIllustration)
        .set({
          imageURL: finalImageURL,
          thumbnailURL: finalThumbURL,
          updatedAt: new Date(),
        })
        .where(eq(schema.songIllustration.id, ill.id));

      console.log(`  ✓ Cleaned up! Moved to trash in R2 and updated D1 paths.`);
    } catch (error) {
      console.error(
        `  ✗ Failed to process ${ill.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // TASK: Cleanup Old R2 Backups (Keep 30 days daily, 1 per month after)
  // ---------------------------------------------------------------------------
  console.log("\nStarting old R2 backup cleanup...");

  try {
    const listResult = await s3.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: "backups/db-backup-",
      }),
    );

    const files = listResult.Contents || [];

    // Calculate the cutoff date (30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const toDelete: { Key: string }[] = [];
    const retainedMonths = new Set<string>();

    for (const file of files) {
      if (!file.Key || !file.LastModified) continue;

      // If the file is older than 30 days, apply the monthly retention logic
      if (file.LastModified < thirtyDaysAgo) {
        // Format as YYYY-MM
        const yearMonth = file.LastModified.toISOString().slice(0, 7);

        if (!retainedMonths.has(yearMonth)) {
          // Keep the first one we encounter for this month
          retainedMonths.add(yearMonth);
        } else {
          // We already have a backup for this month, mark this one for deletion
          toDelete.push({ Key: file.Key });
        }
      }
    }

    if (toDelete.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: R2_BUCKET_NAME,
          Delete: { Objects: toDelete },
        }),
      );
      console.log(`✓ Deleted ${toDelete.length} old backup(s).`);
    } else {
      console.log("✓ No old backups needed cleanup.");
    }
  } catch (error) {
    console.error(
      "✗ Failed to cleanup old backups:",
      error instanceof Error ? error.message : error,
    );
  }

  console.log("\nCleanup complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
