import { Hono } from "hono";
import type { Session, User } from "better-auth";

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
