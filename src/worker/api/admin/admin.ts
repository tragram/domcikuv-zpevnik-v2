import { Context, Next } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { user } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";
import { buildApp } from "../utils";
import { userRoutes } from "./users";
import { songRoutes } from "./songs";
import { changeRoutes } from "./changes";
import { illustrationRoutes } from "./illustrations";

const adminMiddleware = async (c: Context, next: Next) => {
  try {
    const db = drizzle(c.env.DB);
    const userId = c.get("USER")?.id;

    if (!userId) {
      return c.json(
        {
          status: "error",
          message: "Authentication required",
          code: "AUTH_REQUIRED",
        },
        401
      );
    }

    const adminCheckResult = await db
      .select({ isAdmin: user.isAdmin })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (adminCheckResult.length === 0) {
      return c.json(
        {
          status: "error",
          message: "User not found",
          code: "USER_NOT_FOUND",
        },
        404
      );
    }

    if (adminCheckResult.length > 1) {
      console.error("Critical: Multiple users found with same ID:", userId);
      return c.json(
        {
          status: "error",
          message: "Database integrity error",
          code: "DB_INTEGRITY_ERROR",
        },
        500
      );
    }

    const isAdmin = adminCheckResult[0].isAdmin;
    if (import.meta.env.DEV || isAdmin) {
      return next();
    }

    return c.json(
      {
        status: "error",
        message: "Admin privileges required",
        code: "INSUFFICIENT_PRIVILEGES",
      },
      403
    );
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

const adminApp = buildApp()
  .use(adminMiddleware)
  .route("/", userRoutes)
  .route("/", songRoutes)
  .route("/", illustrationRoutes)
  .route("/", changeRoutes);

export default adminApp;
