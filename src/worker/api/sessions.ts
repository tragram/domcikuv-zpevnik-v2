import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { user as userTable } from "src/lib/db/schema";
import { getUserProfile } from "../services/user-service";
import { buildApp } from "./utils";

export { SessionSync } from '../durable-objects/SessionSync';

const sessionSyncApp = buildApp().get('/:masterId', async (c) => {
    // currently using user's nickname as masterId
    const masterId = c.req.param('masterId');

    const user = c.get('USER');
    const db = drizzle(c.env.DB);
    const isMaster = user?(await getUserProfile(db, user.id)).nickname === masterId : false;

    const masterProfile = await db.select({id:userTable.id}).from(userTable).where(eq(userTable.nickname,masterId)).limit(1).then(res => res[0]);
    if (!masterProfile) {
      return c.json({ error: "Master user not found" }, 404);
    }
    const id = c.env.SESSION_SYNC.idFromName(masterId);
    const stub = c.env.SESSION_SYNC.get(id);

    const url = new URL(c.req.url);
    url.searchParams.set("role", isMaster ? "master" : "follower");

    return stub.fetch(url.toString(), c.req.raw);
});

export default sessionSyncApp;
