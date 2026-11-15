// Compatibility entry point for the manual fallback workflow.
import { normalizeStaticImages } from "./sync/images.mjs";
try {
  console.log("Static WebP normalization:", await normalizeStaticImages());
} catch (error) {
  console.error("Image normalization failed; refusing to publish incomplete assets.", error);
  process.exitCode = 1;
}
