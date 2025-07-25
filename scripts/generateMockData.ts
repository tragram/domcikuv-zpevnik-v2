import { faker } from "@faker-js/faker";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { user, session, account } from "../src/lib/db/schema/auth.schema";
import { song, songVersion } from "../src/lib/db/schema/song.schema";
import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";
import { eq } from "drizzle-orm";

interface MockUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
  nickname?: string;
  isTrusted: boolean;
  isAdmin: boolean;
  isFavoritesPublic: boolean;
  lastLogin: Date;
}

interface MockSongChange {
  id: string;
  songId: string;
  userId: string;
  timestamp: Date;
  chordproURL: string;
  verified: boolean;
}

function generateMockUsers(count: number = 50): MockUser[] {
  const users: MockUser[] = [];

  console.log(`Generating ${count} mock users...`);

  users.push({
    id: faker.string.uuid(),
    name: "Dominik Hodan",
    email: "domho108@gmail.com",
    emailVerified: true,
    image: undefined,
    createdAt: new Date(Date.now() - 1),
    updatedAt: new Date(),
    nickname: "Domčík",
    isTrusted: true,
    isAdmin: true,
    isFavoritesPublic: true,
    lastLogin: new Date(),
  });

  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const createdAt = faker.date.past({ years: 2 });
    const lastLogin = faker.date.between({ from: createdAt, to: new Date() });

    // Create some variety in user types
    const isAdmin = faker.datatype.boolean({ probability: 0.05 });
    const isTrusted = isAdmin || faker.datatype.boolean({ probability: 0.2 });

    users.push({
      id: faker.string.uuid(),
      name: `${firstName} ${lastName}`,
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      emailVerified: faker.datatype.boolean({ probability: 0.8 }),
      image: faker.datatype.boolean({ probability: 0.6 })
        ? faker.image.avatar()
        : undefined,
      createdAt,
      updatedAt: faker.date.between({ from: createdAt, to: new Date() }),
      nickname: faker.datatype.boolean({ probability: 0.4 })
        ? faker.internet.username({ firstName, lastName }).toLowerCase()
        : undefined,
      isTrusted,
      isAdmin,
      isFavoritesPublic: faker.datatype.boolean({ probability: 0.3 }),
      lastLogin,
    });
  }

  return users;
}

function generateChordproURL(): string {
  const baseURL = "/songs/chordpro/";
  const filename = `${faker.string.alphanumeric({
    length: 8,
  })}_${Date.now()}.chordpro`;
  return `${baseURL}${filename}`;
}

function generateMockSongChanges(
  users: MockUser[],
  songIds: string[],
  changesPerSong: { min: number; max: number } = { min: 1, max: 8 }
): MockSongChange[] {
  const songVersions: MockSongChange[] = [];

  console.log(`Generating song changes for ${songIds.length} songs...`);

  for (const songId of songIds) {
    const numChanges = faker.number.int(changesPerSong);

    // Create changes with chronological progression
    const songStartDate = faker.date.past({ years: 1 });

    for (let i = 0; i < numChanges; i++) {
      const user = faker.helpers.arrayElement(users);

      // Generate timestamp that's later than previous changes for this song
      const timestamp = faker.date.between({
        from: new Date(songStartDate.getTime()),
        to: new Date(),
      });

      songVersions.push({
        id: faker.string.uuid(),
        songId,
        userId: user.id,
        timestamp,
        chordproURL: generateChordproURL(),
        // Trusted users and admins get auto-verified changes, others do not
        verified: user.isTrusted || user.isAdmin || false,
      });
    }
  }

  // Sort by timestamp for realistic chronological order
  return songVersions.sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
}

async function insertMockUsers(
  db: DrizzleD1Database,
  users: MockUser[]
): Promise<number> {
  let successCount = 0;
  let errorCount = 0;

  console.log("Inserting mock users into database...");

  for (const userData of users) {
    try {
      await db
        .insert(user)
        .values({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          emailVerified: userData.emailVerified,
          image: userData.image || null,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt,
          nickname: userData.nickname || null,
          isTrusted: userData.isTrusted,
          isAdmin: userData.isAdmin,
          isFavoritesPublic: userData.isFavoritesPublic,
          lastLogin: userData.lastLogin,
        })
        .onConflictDoUpdate({
          target: user.id,
          set: {
            name: userData.name,
            email: userData.email,
            emailVerified: userData.emailVerified,
            image: userData.image || null,
            updatedAt: userData.updatedAt,
            nickname: userData.nickname || null,
            isTrusted: userData.isTrusted,
            isAdmin: userData.isAdmin,
            isFavoritesPublic: userData.isFavoritesPublic,
            lastLogin: userData.lastLogin,
          },
        });

      successCount++;
    } catch (err) {
      console.error(`Failed to insert user ${userData.email}:`, err);
      errorCount++;
    }
  }

  console.log(`✅ Users: ${successCount} successful, ${errorCount} errors`);
  return successCount;
}

async function insertMockSongChanges(
  db: DrizzleD1Database,
  songVersions: MockSongChange[]
): Promise<number> {
  let successCount = 0;
  let errorCount = 0;

  console.log("Inserting mock song changes into database...");

  for (const changeData of songVersions) {
    try {
      await db
        .insert(songVersion)
        .values({
          id: changeData.id,
          songId: changeData.songId,
          userId: changeData.userId,
          timestamp: changeData.timestamp,
          chordproURL: changeData.chordproURL,
          verified: changeData.verified,
        })
        .onConflictDoUpdate({
          target: songVersion.id,
          set: {
            songId: changeData.songId,
            userId: changeData.userId,
            timestamp: changeData.timestamp,
            chordproURL: changeData.chordproURL,
            verified: changeData.verified,
          },
        });

      successCount++;
    } catch (err) {
      console.error(`Failed to insert song change ${changeData.id}:`, err);
      errorCount++;
    }
  }

  console.log(
    `✅ Song changes: ${successCount} successful, ${errorCount} errors`
  );
  return successCount;
}

async function fetchExistingSongIds(db: DrizzleD1Database): Promise<string[]> {
  try {
    console.log("Fetching existing song IDs from database...");
    const songs = await db.select({ id: song.id }).from(song);
    const songIds = songs.map((s) => s.id);
    console.log(`Found ${songIds.length} existing songs in database`);
    return songIds;
  } catch (err) {
    console.error("Failed to fetch existing songs:", err);
    throw new Error(
      "Could not fetch existing songs. Make sure the song table is populated first."
    );
  }
}

async function generateMockData(
  db: DrizzleD1Database,
  userCount: number = 50,
  changesPerSong: { min: number; max: number } = { min: 1, max: 8 }
): Promise<void> {
  console.log("Starting mock data generation...");

  // First, fetch existing song IDs
  const songIds = await fetchExistingSongIds(db);

  if (songIds.length === 0) {
    throw new Error(
      "No songs found in database. Please populate the song table first."
    );
  }

  // Generate mock data
  const users = generateMockUsers(userCount);
  const songChanges = generateMockSongChanges(users, songIds, changesPerSong);

  console.log(
    `Generated ${users.length} users and ${songChanges.length} song changes`
  );

  // Insert into database
  const userInserts = await insertMockUsers(db, users);
  const changeInserts = await insertMockSongChanges(db, songChanges);

  console.log("\n📊 Mock Data Generation Summary:");
  console.log(`- Users inserted: ${userInserts}/${users.length}`);
  console.log(
    `- Song changes inserted: ${changeInserts}/${songChanges.length}`
  );
  console.log(`- Songs with changes: ${songIds.length}`);

  // Show some statistics
  const adminUsers = users.filter((u) => u.isAdmin).length;
  const trustedUsers = users.filter((u) => u.isTrusted && !u.isAdmin).length;
  const verifiedChanges = songChanges.filter((c) => c.verified).length;

  console.log("\n📈 Data Statistics:");
  console.log(`- Admin users: ${adminUsers}`);
  console.log(`- Trusted users: ${trustedUsers}`);
  console.log(`- Regular users: ${users.length - adminUsers - trustedUsers}`);
  console.log(
    `- Verified changes: ${verifiedChanges}/${songChanges.length} (${Math.round(
      (verifiedChanges / songChanges.length) * 100
    )}%)`
  );
}

async function main(): Promise<void> {
  try {
    const helper = D1Helper.get("DB");

    // Parse command line arguments
    const userCountArg = process.argv
      .find((arg) => arg.startsWith("--users="))
      ?.split("=")[1];
    const minChangesArg = process.argv
      .find((arg) => arg.startsWith("--min-changes="))
      ?.split("=")[1];
    const maxChangesArg = process.argv
      .find((arg) => arg.startsWith("--max-changes="))
      ?.split("=")[1];

    const userCount = userCountArg ? parseInt(userCountArg) : 50;
    const changesPerSong = {
      min: minChangesArg ? parseInt(minChangesArg) : 1,
      max: maxChangesArg ? parseInt(maxChangesArg) : 8,
    };

    console.log(`Configuration:`);
    console.log(`- Users to generate: ${userCount}`);
    console.log(
      `- Changes per song: ${changesPerSong.min}-${changesPerSong.max}`
    );
    console.log("");

    await helper.useLocalD1(async (db) =>
      generateMockData(db, userCount, changesPerSong)
    );
  } catch (err) {
    console.error("Failed to generate mock data:", err);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
// Check if this is the main module in ES modules
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this script is being run directly
if (process.argv[1] === __filename) {
  main();
}

// Export functions for potential reuse
export { generateMockData, generateMockUsers, generateMockSongChanges };

// To run this script:
// npx tsx scripts/generateMockData.ts
// npx tsx scripts/generateMockData.ts --users=100 --min-changes=2 --max-changes=10
