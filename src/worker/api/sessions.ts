import { eq, gte, or } from "drizzle-orm";
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
        name: user.name,
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

    // Filter out ended sessions (songId is null)
    const activeSessions = Array.from(latestByMasterId.values()).filter(
      (s: any) => s.songId !== null,
    );

    const uniqueSessions = activeSessions.map((s: any) => ({
      ...s,
      nickname: s.nickname || s.name,
    }));

    return successJSend(c, uniqueSessions as SessionsResponseData);
  })
  .post(
    "/:masterNickname",
    zValidator("json", z.object({ songId: z.string().nullable() })),
    async (c) => {
      const masterNickname = c.req.param("masterNickname");
      const user = c.var.USER;

      if (!user) return errorJSend(c, "Authentication required", 401);

      const db = c.var.db;
      const masterProfile = await db
        .select({
          id: userTable.id,
          nickname: userTable.nickname,
          name: userTable.name,
        })
        .from(userTable)
        .where(
          or(
            eq(userTable.nickname, masterNickname),
            eq(userTable.name, masterNickname),
          ),
        )
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
  .get("/:masterNickname", async (c) => {
    const masterNickname = c.req.param("masterNickname");
    const requestedRole = new URL(c.req.url).searchParams.get("role");
    const user = c.var.USER;

    const db = c.var.db;
    const masterProfile = await db
      .select({
        id: userTable.id,
        avatar: userTable.image,
        nickname: userTable.nickname,
        name: userTable.name,
      })
      .from(userTable)
      .where(
        or(
          eq(userTable.nickname, masterNickname),
          eq(userTable.name, masterNickname),
        ),
      )
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
    const displayName = masterProfile.nickname || masterProfile.name;
    url.searchParams.set("masterNickname", displayName);
    url.searchParams.set("masterId", masterProfile.id);
    if (masterProfile.avatar)
      url.searchParams.set("masterAvatar", masterProfile.avatar);

    return stub.fetch(url.toString(), c.req.raw);
  });

export default sessionSyncApp;
