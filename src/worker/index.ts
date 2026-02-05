/// <reference types="../../worker-configuration.d.ts" />
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { user } from "src/lib/db/schema/auth.schema";
import { auth } from "../lib/auth/server";
import adminApp, { adminOrTrustedMiddleware } from "./api/admin/admin";
import { trustedGenerateRoute } from "./api/admin/illustrations";
import authApp from "./api/auth";
import editorApp from "./api/editor";
import favoritesApp from "./api/favorites";
import sessionSyncApp from "./api/sessions";
import songDBRoutes from "./api/songDB";
import profileApp from "./api/userProfile";
import { buildApp } from "./api/utils";
export { SessionSync } from "./durable-objects/SessionSync";

const app = buildApp();

export const route = app
  .basePath("/api")
  .use(async (c, next) => {
    const db = drizzle(c.env.DB);
    const authInstance = auth(c.env, db);
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
  .route("/admin", adminApp)
  .route(
    "/illustrations",
    buildApp().use(adminOrTrustedMiddleware).route("/", trustedGenerateRoute)
  )
  .route("/session", sessionSyncApp);

export default route;
