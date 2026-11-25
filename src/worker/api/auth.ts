import { buildApp } from "./utils";
import { auth } from "src/lib/auth/server";

const authApp = buildApp().on(["POST", "GET"], "/*", (c) => {
  const authInstance = auth(c.env, c.var.db);
  return authInstance.handler(c.req.raw);
});

export default authApp;
