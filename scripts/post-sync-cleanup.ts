import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import fs from "fs";
import path from "path";

// 1. Setup R2 (S3 Client)
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID!.trim()}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
  },
});

// 2. Setup Drizzle proxy
const db = drizzle(
  async (sql, params, method) => {
    const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID!.trim()}/d1/database/${process.env.CF_DATABASE_ID!.trim()}/query`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CF_API_TOKEN!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });
    if (!response.ok) throw new Error(`D1 Query Failed: ${response.status}`);
    const data = await response.json();
    const rows = data.result[0].results.map((row: any) => Object.values(row));
    return { rows };
  },
  { schema },
);

async function main() {
  console.log("Starting post-sync cleanup...");

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

      // 4. VERIFY FILE EXISTS LOCALLY
      // Strip leading slash from URL to ensure cross-platform path joining works reliably
      const relativeFilePath = finalImageURL.replace(/^\/+/, "");
      const localFilePath = path.join(process.cwd(), relativeFilePath);

      if (!fs.existsSync(localFilePath)) {
        console.log(`\n[SKIP] ID: ${ill.id}`);
        console.log(`  -> Expected static file missing at: ${localFilePath}`);
        console.log(`  -> Keeping R2 fallback intact.`);
        continue;
      }

      console.log(`\n[PROCESSING] ID: ${ill.id}`);

      // 5. Move ONLY the full image to /trash in R2 using the S3 SDK
      await s3.send(
        new CopyObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          CopySource: `${process.env.R2_BUCKET_NAME}/${oldKey}`,
          Key: trashKey,
        }),
      );

      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
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
      console.error(`  ✗ Failed to process ${ill.id}:`, error.message);
    }
  }

  // ---------------------------------------------------------------------------
  // TASK: Cleanup Old R2 Backups (Keep 30 days daily, 1 per month after)
  // ---------------------------------------------------------------------------
  console.log("\nStarting old R2 backup cleanup...");

  try {
    const listResult = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
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
          Bucket: process.env.R2_BUCKET_NAME,
          Delete: { Objects: toDelete },
        }),
      );
      console.log(`✓ Deleted ${toDelete.length} old backup(s).`);
    } else {
      console.log("✓ No old backups needed cleanup.");
    }
  } catch (error) {
    console.error("✗ Failed to cleanup old backups:", error.message);
  }

  console.log("\nCleanup complete!");
}

main().catch(console.error);
