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
