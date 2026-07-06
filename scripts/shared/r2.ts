/**
 * R2 (S3-compatible) client for one-off scripts.
 * Env: CF_ACCOUNT_ID (or CLOUDFLARE_ACCOUNT_ID), R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME.
 */
import { S3Client } from "@aws-sdk/client-s3";

import { requireEnv } from "./env";

export const R2_BUCKET_NAME = requireEnv("R2_BUCKET_NAME");

export const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${requireEnv("CF_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  },
});
