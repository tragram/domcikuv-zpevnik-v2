import { eq, gte, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { syncSessionTable, user, user as userTable } from "src/lib/db/schema";
import { getUserProfile } from "../services/user-service";
import { buildApp } from "./utils";
import { errorJSend, successJSend } from "./responses";

export { SessionSync } from "../durable-objects/SessionSync";

export type SyncSession = {
  masterId: string;
  createdAt: Date;
  avatar: string | undefined;
};

export type SessionsResponseData = SyncSession[];

const sessionSyncApp = buildApp()
  .get("/", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const latestLive = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const liveSessions = await db
        .select({
          masterId: syncSessionTable.masterId,
          createdAt: syncSessionTable.createdAt,
          avatar: user.image,
        })
        .from(syncSessionTable)
        .where(gte(syncSessionTable.createdAt, latestLive))
        .leftJoin(user, eq(user.id, syncSessionTable.userId))
        .all();

      // Filter to only the latest entry per masterId
      const latestByMasterId = liveSessions.reduce((acc, session) => {
        const existing = acc.get(session.masterId);
        if (!existing || session.createdAt > existing.createdAt) {
          acc.set(session.masterId, session);
        }
        return acc;
      }, new Map());

      const uniqueSessions = Array.from(latestByMasterId.values());

      return successJSend(c, uniqueSessions as SessionsResponseData);
    } catch (error) {
      console.error("Database error:", error);
      return errorJSend(c, "Failed to fetch current sessions", 500);
    }
  })
  .get("/:masterId", async (c) => {
    const masterId = c.req.param("masterId");
    const requestedRole = new URL(c.req.url).searchParams.get("role");
    let userId: string | null = null;

    const user = c.get("USER");

    // Verify the master user exists
    const db = drizzle(c.env.DB);
    const masterProfile = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.nickname, masterId))
      .limit(1)
      .then((res) => res[0]);

    if (!masterProfile) {
      return errorJSend(c, "Master user not found", 404);
    }

    // Verify permission if client claims to be master
    let verifiedRole = "follower";
    if (requestedRole === "master") {
      if (!user) {
        return errorJSend(c, "Authentication required to be master", 401);
      }

      const userProfile = await getUserProfile(db, user.id);
      const isAuthorized = userProfile.nickname === masterId;

      if (!isAuthorized) {
        return errorJSend(
          c,
          "Not authorized to be master for this session",
          403
        );
      }
      userId = masterProfile.id;
      verifiedRole = "master";
    }

    // Forward to Durable Object with verified role
    const id = c.env.SESSION_SYNC.idFromName(masterId);
    const stub = c.env.SESSION_SYNC.get(id);

    const url = new URL(c.req.url);
    url.searchParams.set("role", verifiedRole);
    if (userId) {
      url.searchParams.set("userId", userId);
    }
    url.searchParams.set("masterId", masterId);

    return stub.fetch(url.toString(), c.req.raw);
  });
export default sessionSyncApp;
