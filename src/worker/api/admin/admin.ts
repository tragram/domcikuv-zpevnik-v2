import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Context, Next } from "hono";
import { user } from "../../../lib/db/schema";
import { buildApp } from "../utils";
import { illustrationPromptRoutes } from "./illustration-prompts";
import { illustrationRoutes } from "./illustrations";
import { songRoutes } from "./songs";
import { userRoutes } from "./users";

// Shared auth check logic
const checkUserPermissions = async (c: Context, requireAdmin: boolean = true) => {
  const db = drizzle(c.env.DB);
  const userId = c.get("USER")?.id;

  if (!userId) {
    return {
      error: c.json(
        {
          status: "error",
          message: "Authentication required",
          code: "AUTH_REQUIRED",
        },
        401
      ),
    };
  }

  const userCheckResult = await db
    .select({ 
      isAdmin: user.isAdmin,
      isTrusted: user.isTrusted 
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (userCheckResult.length === 0) {
    return {
      error: c.json(
        {
          status: "error",
          message: "User not found",
          code: "USER_NOT_FOUND",
        },
        404
      ),
    };
  }

  if (userCheckResult.length > 1) {
    console.error("Critical: Multiple users found with same ID:", userId);
    return {
      error: c.json(
        {
          status: "error",
          message: "Database integrity error",
          code: "DB_INTEGRITY_ERROR",
        },
        500
      ),
    };
  }

  const { isAdmin, isTrusted } = userCheckResult[0];
  
  // In dev mode, allow everything
  if (import.meta.env.DEV) {
    return { authorized: true };
  }

  // Check permissions based on requirement
  if (requireAdmin && !isAdmin) {
    return {
      error: c.json(
        {
          status: "error",
          message: "Admin privileges required",
          code: "INSUFFICIENT_PRIVILEGES",
        },
        403
      ),
    };
  }

  if (!requireAdmin && !isAdmin && !isTrusted) {
    return {
      error: c.json(
        {
          status: "error",
          message: "Admin or trusted user privileges required",
          code: "INSUFFICIENT_PRIVILEGES",
        },
        403
      ),
    };
  }

  return { authorized: true };
};

const adminMiddleware = async (c: Context, next: Next) => {
  try {
    const result = await checkUserPermissions(c, true);
    if (result.error) return result.error;
    return next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    return c.json(
      {
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      500
    );
  }
};

export const adminOrTrustedMiddleware = async (c: Context, next: Next) => {
  try {
    const result = await checkUserPermissions(c, false);
    if (result.error) return result.error;
    return next();
  } catch (error) {
    console.error("Admin/trusted middleware error:", error);
    return c.json(
      {
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      500
    );
  }
};

const adminApp = buildApp()
  .use(adminMiddleware)
  .route("/songs", songRoutes)
  .route("/illustrations", illustrationRoutes)
  .route("/prompts", illustrationPromptRoutes)
  .route("/users", userRoutes);

export default adminApp;