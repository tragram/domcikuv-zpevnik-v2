// hono client
import { hc } from "hono/client";
import { route } from "./index";

type AppType = typeof route;

const client = hc<AppType>("/");

export default client;
