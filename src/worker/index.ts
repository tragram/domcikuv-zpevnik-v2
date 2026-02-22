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
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { errorJSend, failJSend } from "./api/responses";
export { SessionSync } from "./durable-objects/SessionSync";
import * as schema from "src/lib/db/schema";

const app = buildApp();

// 1. Centralized Error Handling
// Catches all unhandled exceptions thrown in any downstream route
app.onError((err, c) => {
  console.error("Global Error Handler caught:", err);

  // Handle expected HTTP errors (like 401, 404 thrown via new HTTPException)
  if (err instanceof HTTPException) {
    return errorJSend(c, err.message, err.status);
  }

  // Handle Zod validation errors globally so routes don't have to
  if (err instanceof z.ZodError) {
    return failJSend(c, err.flatten().formErrors[0] || "Validation error", 400);
  }

  // Fallback for unexpected errors
  return errorJSend(
    c,
    err instanceof Error ? err.message : "Internal server error",
    500,
  );
});

export const route = app
  .basePath("/api")
  .use(async (c, next) => {
    // 2. Global DB Initialization and Injection
    const db = drizzle(c.env.DB, { schema });
    c.set("db", db); // Make 'db' available to all downstream routes via c.get("db")

    const authInstance = auth(c.env, db);
    const session = await authInstance.api.getSession(c.req.raw);

    if (session?.session) {
      c.set("SESSION", session.session);
      c.set("USER", session.user);

      // 3. Optimization: Fire and forget the login update
      // This prevents the DB write from blocking the response back to the client
      c.executionCtx.waitUntil(
        db
          .update(user)
          .set({ lastLogin: new Date() })
          .where(eq(user.id, session.user.id)),
      );
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
    buildApp().use(adminOrTrustedMiddleware).route("/", trustedGenerateRoute),
  )
  .route("/session", sessionSyncApp);

export default route;
