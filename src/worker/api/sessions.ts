import { eq, gte } from "drizzle-orm";
import { syncSession, user, user as userTable } from "src/lib/db/schema";
import { errorJSend, successJSend } from "./responses";
import { buildApp } from "./utils";

export { SessionSync } from "../durable-objects/SessionSync";

export type SyncSessionData = {
  masterId: string;
  timestamp: Date;
  songId: string;
  avatar: string | undefined;
  nickname: string;
};

export type SessionsResponseData = SyncSessionData[];

const sessionSyncApp = buildApp()
  .get("/", async (c) => {
    const db = c.var.db;
    const latestLive = new Date(Date.now() - 3 * 60 * 60 * 1000);

    const liveSessions = await db
      .select({
        masterId: syncSession.masterId,
        timestamp: syncSession.timestamp,
        songId: syncSession.songId,
        avatar: user.image,
        nickname: user.nickname,
      })
      .from(syncSession)
      .where(gte(syncSession.timestamp, latestLive))
      .leftJoin(user, eq(user.id, syncSession.masterId))
      .all();
    // Filter to only the latest entry per masterId

    const latestByMasterId = liveSessions.reduce((acc, session) => {
      const existing = acc.get(session.masterId);
      if (!existing || session.timestamp > existing.timestamp) {
        acc.set(session.masterId, session);
      }
      return acc;
    }, new Map());

    const uniqueSessions = Array.from(latestByMasterId.values());

    return successJSend(c, uniqueSessions as SessionsResponseData);
  })
  .get("/:masterNickname", async (c) => {
    const masterNickname = c.req.param("masterNickname");
    const requestedRole = new URL(c.req.url).searchParams.get("role");
    const user = c.var.USER;
    // Verify the master user exists
    const db = c.var.db;
    const masterProfile = await db
      .select({ id: userTable.id, avatar: userTable.image })
      .from(userTable)
      .where(eq(userTable.nickname, masterNickname))
      .get();

    if (!masterProfile) return errorJSend(c, "Master user not found", 404);

    let verifiedRole = "follower";
    if (requestedRole === "master") {
      if (!user)
        return errorJSend(c, "Authentication required to be master", 401);
      if (masterProfile.id !== user.id)
        return errorJSend(
          c,
          "Not authorized to be master for this session",
          403,
        );
      verifiedRole = "master";
    }

    const id = c.env.SESSION_SYNC.idFromName(masterProfile.id);
    const stub = c.env.SESSION_SYNC.get(id);

    const url = new URL(c.req.url);
    url.searchParams.set("role", verifiedRole);
    if (masterNickname) url.searchParams.set("masterNickname", masterNickname);
    url.searchParams.set("masterId", masterProfile.id);
    if (masterProfile.avatar)
      url.searchParams.set("masterAvatar", masterProfile.avatar);

    return stub.fetch(url.toString(), c.req.raw);
  });

export default sessionSyncApp;
