// hono client
import { hc } from "hono/client";
// type-only: importing the route value would pull the whole worker (and its
// server-only SDKs) into the client bundle
import type { route } from "./index";

type AppType = typeof route;

const client = hc<AppType>("/");

export type API = typeof client.api;
export type FavoritesAPI = API["favorites"];
export type SongsAPI = API["songs"];
export type EditorAPI = API["editor"];
export type AdminApi = typeof client.api.admin;

export default client;