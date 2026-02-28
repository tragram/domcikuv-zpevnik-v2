import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

// 1. Setup R2 (S3 Client)
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CF_ACCOUNT_ID!.trim()}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
  },
});

// 2. Setup Drizzle proxy
const db = drizzle(
  async (sql, params, method) => {
    const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID!.trim()}/d1/database/${process.env.CF_DATABASE_ID!.trim()}/query`;
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
  console.log("Starting post-sync cleanup (DRY RUN MODE)...");

  // 1. Find all illustrations that still have absolute HTTP URLs
  const illustrations = await db.select().from(schema.songIllustration);
  const pendingCleanup = illustrations.filter((ill: any) =>
    ill.imageURL.startsWith("http"),
  );

  console.log(`Found ${pendingCleanup.length} synced images pending cleanup.`);

  for (const ill of pendingCleanup) {
    try {
      // 2. Parse out the relative paths
      const parsedImageURL = new URL(ill.imageURL);
      const relativeImageURL = parsedImageURL.pathname;
      const parsedThumbURL = new URL(ill.thumbnailURL);
      const relativeThumbURL = parsedThumbURL.pathname;

      const oldKey = relativeImageURL.slice(1); // Strip leading slash
      const trashKey = `trash/${oldKey}`;

      // 3. Log the intended actions
      console.log(`\n[DRY RUN] Processing Illustration ID: ${ill.id}`);
      console.log(`  - Would COPY in R2: ${oldKey} -> ${trashKey}`);
      console.log(`  - Would DELETE in R2: ${oldKey}`);
      console.log(`  - Would UPDATE DB: imageURL -> ${relativeImageURL}`);
      console.log(`  - Would UPDATE DB: thumbnailURL -> ${relativeThumbURL}`);

      /* ====================================================================
         DANGER ZONE: Uncomment this block to enable actual cleanup
         ==================================================================== 
      
      // Move the file to /trash in R2 using the S3 SDK
      await s3.send(new CopyObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        CopySource: `${process.env.R2_BUCKET_NAME}/${oldKey}`,
        Key: trashKey
      }));
      
      await s3.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: oldKey
      }));

      // Update the D1 database to use the relative static paths
      await db.update(schema.songIllustration)
        .set({ 
          imageURL: relativeImageURL, 
          thumbnailURL: relativeThumbURL 
        })
        .where(eq(schema.songIllustration.id, ill.id));

      console.log(`✓ Cleaned up ${ill.id}: Moved to trash and updated DB.`);
      
      ==================================================================== */
    } catch (error: any) {
      console.error(`✗ Failed to process ${ill.id}:`, error.message);
    }
  }

  console.log("\nCleanup (Dry Run) complete!");
}

main().catch(console.error);
