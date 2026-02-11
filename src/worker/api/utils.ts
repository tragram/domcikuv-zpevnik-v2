import { Hono } from "hono";
import type { Session, User } from "better-auth";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Context, Next } from "hono";
import { user } from "src/lib/db/schema";

export const buildApp = () =>
  new Hono<{
    Bindings: Env;
    Variables: {
      SESSION: Session | null;
      USER: User | null;
    };
  }>();

export type PaginatedResponse<T, K extends string> = {
  [key in K]: T;
} & {
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    currentPage: number;
    totalPages: number;
  };
};

export const trustedUserMiddleware = async (c: Context, next: Next) => {
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

    const isTrustedCheckResult = await db
      .select({ isTrusted: user.isTrusted })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (isTrustedCheckResult.length === 0) {
      return c.json(
        {
          status: "error",
          message: "User not found",
          code: "USER_NOT_FOUND",
        },
        404
      );
    }

    const isTrusted = isTrustedCheckResult[0].isTrusted;
    if (import.meta.env.DEV || isTrusted) {
      return next();
    }

    return c.json(
      {
        status: "error",
        message: "Trusted user privileges required",
        code: "INSUFFICIENT_PRIVILEGES",
      },
      403
    );
  } catch (error) {
    console.error("Trusted user middleware error:", error);
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
