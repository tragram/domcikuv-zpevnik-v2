import { eq } from "drizzle-orm";
import { Context, Next } from "hono";
import { user } from "../../../lib/db/schema";
import { buildApp } from "../utils";
import { illustrationPromptRoutes } from "./illustration-prompts";
import { illustrationRoutes } from "./illustrations";
import { songRoutes } from "./songs";
import { userRoutes } from "./users";
import { failJSend } from "../responses";

const checkUserPermissions = async (
  c: Context,
  requireAdmin: boolean = true,
) => {
  const db = c.var.db;
  const userId = c.var.USER?.id;

  if (!userId) {
    return {
      error: failJSend(c, "Authentication required", 401, "AUTH_REQUIRED"),
    };
  }

  const userRecord = await db
    .select({ isAdmin: user.isAdmin, isTrusted: user.isTrusted })
    .from(user)
    .where(eq(user.id, userId))
    .get();

  if (!userRecord) {
    return { error: failJSend(c, "User not found", 404, "USER_NOT_FOUND") };
  }

  // In dev mode, allow everything
  if (import.meta.env.DEV) return { authorized: true };

  // Check permissions based on requirement
  if (requireAdmin && !userRecord.isAdmin) {
    return {
      error: failJSend(
        c,
        "Admin privileges required",
        403,
        "INSUFFICIENT_PRIVILEGES",
      ),
    };
  }

  if (!requireAdmin && !userRecord.isAdmin && !userRecord.isTrusted) {
    return {
      error: failJSend(
        c,
        "Admin or trusted user privileges required",
        403,
        "INSUFFICIENT_PRIVILEGES",
      ),
    };
  }

  return { authorized: true };
};

const adminMiddleware = async (c: Context, next: Next) => {
  const result = await checkUserPermissions(c, true);
  if (result.error) return result.error;
  return next();
};

export const adminOrTrustedMiddleware = async (c: Context, next: Next) => {
  const result = await checkUserPermissions(c, false);
  if (result.error) return result.error;
  return next();
};

const adminApp = buildApp()
  .use(adminMiddleware)
  .route("/songs", songRoutes)
  .route("/illustrations", illustrationRoutes)
  .route("/prompts", illustrationPromptRoutes)
  .route("/users", userRoutes);

export default adminApp;
