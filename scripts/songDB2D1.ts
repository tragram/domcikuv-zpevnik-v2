import { readFileSync } from "fs";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { song, songIllustration } from "../src/lib/db/schema/song.schema";
import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";

function to_ascii(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function songId(title: string, artist: string): string {
  return `${to_ascii(artist)}-${to_ascii(title)}`
    .replace(/ /g, "_")
    .replace(/[^A-Za-z0-9-_]+/g, "")
    .replace(/_+/g, "_");
}

function parseDateToTimestamp(dateStr: string): Date {
  const [month, year] = dateStr.split("-");
  return new Date(parseInt(year), parseInt(month) - 1);
}

async function songDB2D1(
  db: DrizzleD1Database,
  songDBPath = "public/songDB.json"
) {
  const raw = readFileSync(songDBPath, "utf8");
  const entries = JSON.parse(raw);
  const now = new Date();

  for (const entry of entries) {
    const id = songId(entry.title, entry.artist);
    try {
      await db
        .insert(song)
        .values({
          id,
          title: entry.title,
          artist: entry.artist,
          key: entry.key ?? "C",
          language: entry.language ?? "unknown",
          chordproURL: `/songs/chordpro/${entry.chordproFile}`,
          startMelody: entry.startMelody || null,
          tempo: entry.tempo || null,
          capo: entry.capo ? parseInt(entry.capo) : 0,
          range: entry.range || null,
          dateAdded: entry.dateAdded
            ? parseDateToTimestamp(entry.dateAdded)
            : now,
          dateModified: now,
        })
        .onConflictDoUpdate({
          target: song.id,
          set: { ...entry },
        });
    } catch (err) {
      console.error(
        `Failed to insert illustrations for song "${entry.title}" by ${entry.artist}:`,
        err
      );
    }

    let illustrations: string[] = [];
    try {
      illustrations = JSON.parse(entry.availableIllustrations);
    } catch {
      continue;
    }

    // Determine which model is active
    let activeModel: string | undefined;

    if (entry.promptModel || entry.promptId || entry.imageModel) {
      const composite = `${entry.promptModel || "gpt-4o-mini"}_${
        entry.promptId || "v1"
      }_${entry.imageModel || "FLUX.1-dev"}`;
      activeModel = illustrations.find((m) => m === composite);
    } else {
      if (illustrations.includes("gpt-4o-mini_v2_FLUX.1-dev")) {
        activeModel = "gpt-4o-mini_v2_FLUX.1-dev";
      } else if (illustrations.includes("gpt-4o-mini_v1_FLUX.1-dev")) {
        activeModel = "gpt-4o-mini_v1_FLUX.1-dev";
      } else {
        console.warn(
          `⚠️ No preferred active illustration for "${entry.title}" by ${entry.artist}`
        );
      }
    }

    for (const model of illustrations) {
      const parts = model.split("_");
      const promptModel = parts[0];
      const promptId = parts[1];
      const imageModel = parts[2];

      const compositeName = `${promptModel}_${promptId}_${imageModel}`;
      const illustrationId = `${id}_${compositeName}`;

      try {
        await db.insert(songIllustration).values({
          id: illustrationId,
          songId: id,
          promptModel,
          promptId,
          imageModel,
          imageURL: `/songs/illustrations/${id}/${compositeName}.webp`,
          thumbnailURL: `/songs/illustrations/thumbnails/${id}/${compositeName}.webp`,
          isActive: model === activeModel,
          createdAt: now,
        });
      } catch (err) {
        console.error(
          `Failed to insert illustrations for song "${entry.title}" by ${entry.artist}:`,
          err
        );
      }
    }
  }

  console.log("✅ Import complete.");
}

const helper = D1Helper.get("DB");
helper.useLocalD1(async (db) => songDB2D1(db));
