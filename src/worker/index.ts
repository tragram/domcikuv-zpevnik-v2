/// <reference types="../../worker-configuration.d.ts" />
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { user } from "src/lib/db/schema/auth.schema";
import { auth } from "../lib/auth/server";
import adminApp, { adminOrTrustedMiddleware } from "./api/admin/admin";
import {
  coreGenerateIllustration,
  trustedGenerateRoute,
} from "./api/admin/illustrations";
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
import { IllustrationGenerateSchema } from "./api/api-types"; // Or wherever your schema type lives

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
    // Global DB Initialization and Injection
    const db = drizzle(c.env.DB, { schema });
    c.set("db", db);

    const authInstance = auth(c.env, db);
    const session = await authInstance.api.getSession(c.req.raw);
    console.log(c.req.url, session?.user.name);
    if (session?.session) {
      c.set("SESSION", session.session);
      c.set("USER", session.user);

      // Fire and forget the login update
      c.executionCtx.waitUntil(
        db
          .update(user)
          .set({ lastLogin: new Date() })
          .where(eq(user.id, session.user.id))
          .execute(),
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

// Export the handlers for both HTTP and Queues
export default {
  // 1. Handle normal HTTP requests via Hono
  fetch: route.fetch,

  // 2. Handle background Queue messages
  async queue(
    batch: MessageBatch<IllustrationGenerateSchema>,
    env: Env,
    ctx: ExecutionContext,
  ) {
    // Initialize the DB for the background worker (since it bypasses Hono middleware)
    const db = drizzle(env.DB, { schema });

    for (const message of batch.messages) {
      try {
        console.log(
          `Processing illustration generation for song: ${message.body.songId}`,
        );

        // Pass the env, db, and payload to your isolated logic
        await coreGenerateIllustration(env, db, message.body);

        // Acknowledge the message so it isn't retried
        message.ack();
      } catch (error) {
        console.error(
          `Queue generation failed for song ${message.body.songId}:`,
          error,
        );

        // If it fails, message.retry() puts it back in the queue to try again later
        // Cloudflare will automatically handle the backoff based on your wrangler.toml max_retries
        message.retry();
      }
    }
  },
};
