import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// We want to look inside the songs/illustrations directory
const ILLUSTRATIONS_DIR = path.join(process.cwd(), 'songs', 'illustrations');
const THUMBNAIL_WIDTH = 128; // Your PWA thumbnail size

async function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // If we found a "full" directory, process its images
      if (entry.name === 'full') {
        await generateThumbnailsForDir(fullPath);
      } else {
        // Otherwise, keep searching recursively
        await processDirectory(fullPath);
      }
    }
  }
}

async function generateThumbnailsForDir(fullDir) {
  // The thumbnail directory should be parallel to the "full" directory
  const thumbDir = path.join(path.dirname(fullDir), 'thumbnail');
  
  if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true });
  }

  const images = fs.readdirSync(fullDir).filter(file => file.endsWith('.webp'));

  for (const image of images) {
    const inputPath = path.join(fullDir, image);
    const outputPath = path.join(thumbDir, image);

    // Skip if the thumbnail already exists to save Action minutes
    if (fs.existsSync(outputPath)) {
      continue;
    }

    console.log(`Generating thumbnail for: ${image}`);
    try {
      await sharp(inputPath)
        .resize({ width: THUMBNAIL_WIDTH })
        .webp({ quality: 80 })
        .toFile(outputPath);
      console.log(`✓ Created: ${outputPath}`);
    } catch (error) {
      console.error(`✗ Failed to process ${image}:`, error);
    }
  }
}

console.log('Starting thumbnail generation...');
await processDirectory(ILLUSTRATIONS_DIR);
console.log('Thumbnail generation complete.');