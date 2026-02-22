import { Hono } from "hono";
import type { Session, User } from "better-auth";
import { eq } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { Context, Next } from "hono";
import { user } from "src/lib/db/schema";
import * as schema from "src/lib/db/schema";

export type AppDatabase = DrizzleD1Database<typeof schema>;
export type AppEnv = {
  Bindings: Env;
  Variables: {
    SESSION: Session | null;
    USER: User | null;
    db: AppDatabase;
  };
};

export const buildApp = () => new Hono<AppEnv>();

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

export const trustedUserMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const db = c.var.db;
  const userId = c.var.USER?.id;

  if (!userId) {
    return c.json(
      {
        status: "error",
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      },
      401,
    );
  }

  const userRecord = await db
    .select({ isTrusted: user.isTrusted })
    .from(user)
    .where(eq(user.id, userId))
    .get();

  if (!userRecord) {
    return c.json(
      {
        status: "error",
        message: "User not found",
        code: "USER_NOT_FOUND",
      },
      404,
    );
  }

  if (import.meta.env.DEV || userRecord.isTrusted) {
    return await next();
  }

  return c.json(
    {
      status: "error",
      message: "Trusted user privileges required",
      code: "INSUFFICIENT_PRIVILEGES",
    },
    403,
  );
};
