import { drizzle } from "drizzle-orm/d1";
import { buildApp } from "./utils";
import { auth } from "src/lib/auth/server";

const authApp = buildApp().on(["POST", "GET"], "/*", (c) => {
  const db = drizzle(c.env.DB);
  const authInstance = auth(db);
  return authInstance.handler(c.req.raw);
});

export default authApp;
