import { eq, gte } from "drizzle-orm";
import { syncSession, user, user as userTable } from "src/lib/db/schema";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { errorJSend, successJSend } from "./responses";
import { ContentfulStatusCode } from "hono/utils/http-status";
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
    }, new Map<string, (typeof liveSessions)[number]>());

    // Keep only live sessions (songId set) that are addressable: a session is
    // followed via /feed/:nickname, so a master without a nickname can't be
    // linked to and is omitted from discovery.
    const activeSessions = Array.from(latestByMasterId.values()).filter(
      (s) => s.songId !== null && s.nickname,
    );

    return successJSend(c, activeSessions as SessionsResponseData);
  })
  .post(
    "/:masterNickname",
    zValidator("param", z.object({ masterNickname: z.string().min(1) })),
    zValidator("json", z.object({ songId: z.string().nullable() })),
    async (c) => {
      const { masterNickname } = c.req.valid("param");
      const user = c.var.USER;

      if (!user) return errorJSend(c, "Authentication required", 401);

      const db = c.var.db;
      const masterProfile = await db
        .select({
          id: userTable.id,
          nickname: userTable.nickname,
        })
        .from(userTable)
        .where(eq(userTable.nickname, masterNickname))
        .get();

      if (!masterProfile || masterProfile.id !== user.id) {
        return errorJSend(c, "Not authorized to modify this session", 403);
      }

      // Forward to the Durable Object, which nulls its state, writes D1, and
      // broadcasts. A relay master sends null to drop out of the discovery list;
      // followers ignore the null broadcast and keep showing the last song.
      const { songId } = c.req.valid("json");
      const id = c.env.SESSION_SYNC.idFromName(masterProfile.id);
      const stub = c.env.SESSION_SYNC.get(id);

      const newReq = new Request(c.req.url, {
        method: "POST",
        headers: c.req.raw.headers,
        body: JSON.stringify({ songId }),
      });

      const doRes = await stub.fetch(newReq);
      if (!doRes.ok) return errorJSend(c, "Session update failed", doRes.status as ContentfulStatusCode);
      return successJSend(c, null);
    },
  )
  .get(
    "/:masterNickname",
    zValidator("param", z.object({ masterNickname: z.string().min(1) })),
    zValidator("query", z.object({ role: z.enum(["master", "follower"]).optional() })),
    async (c) => {
      const { masterNickname } = c.req.valid("param");
      const { role: requestedRole } = c.req.valid("query");
      const user = c.var.USER;

      const db = c.var.db;
      const masterProfile = await db
        .select({
          id: userTable.id,
          avatar: userTable.image,
          nickname: userTable.nickname,
        })
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
      // Non-null: the profile was matched by exactly this nickname above.
      url.searchParams.set("masterNickname", masterProfile.nickname ?? masterNickname);
      url.searchParams.set("masterId", masterProfile.id);
      if (masterProfile.avatar)
        url.searchParams.set("masterAvatar", masterProfile.avatar);

      return stub.fetch(url.toString(), c.req.raw);
    },
  );

export default sessionSyncApp;
