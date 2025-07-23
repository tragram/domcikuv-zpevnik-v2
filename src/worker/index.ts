/// <reference types="../../worker-configuration.d.ts" />
import { drizzle } from "drizzle-orm/d1";
import { auth } from "../lib/auth/server";
import { buildApp } from "./api/utils";
import favoritesApp from "./api/favorites";
import profileApp from "./api/userProfile";
import authApp from "./api/auth";
import editorApp from "./api/editor";
import adminApp from "./api/admin/admin";
import { user } from "src/lib/db/schema/auth.schema";
import { eq } from "drizzle-orm";
import songDBRoutes from "./api/songDB";

const app = buildApp();

export const route = app
  .basePath("/api")
  .use(async (c, next) => {
    const db = drizzle(c.env.DB);
    const authInstance = auth(db);
    const session = await authInstance.api.getSession(c.req.raw);
    if (session?.session) {
      c.set("SESSION", session.session);
      c.set("USER", session.user);
      await db
        .update(user)
        .set({ lastLogin: new Date() })
        .where(eq(user.id, session.user.id));
    }
    return next();
  })
  .route("/auth", authApp)
  .route("/songs", songDBRoutes)
  .route("/favorites", favoritesApp)
  .route("/editor", editorApp)
  .route("/profile", profileApp)
  .route("/admin", adminApp);

export default route;
