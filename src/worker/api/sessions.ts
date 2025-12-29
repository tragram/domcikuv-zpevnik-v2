import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { user as userTable } from "src/lib/db/schema";
import { getUserProfile } from "../services/user-service";
import { buildApp } from "./utils";
import { errorJSend } from "./responses";

export { SessionSync } from "../durable-objects/SessionSync";

const sessionSyncApp = buildApp().get("/:masterId", async (c) => {
  const masterId = c.req.param("masterId");
  const requestedRole = new URL(c.req.url).searchParams.get("role");

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
      return errorJSend(c, "Not authorized to be master for this session", 403);
    }

    verifiedRole = "master";
  }

  // Forward to Durable Object with verified role
  const id = c.env.SESSION_SYNC.idFromName(masterId);
  const stub = c.env.SESSION_SYNC.get(id);

  const url = new URL(c.req.url);
  url.searchParams.set("role", verifiedRole);

  return stub.fetch(url.toString(), c.req.raw);
});

export default sessionSyncApp;
