import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { D1Helper } from "@nerdfolio/drizzle-d1-helpers";

const url = D1Helper.get("DB").sqliteLocalFileCredentials.url;
execFileSync(process.execPath, [fileURLToPath(new URL("../node_modules/drizzle-kit/bin.cjs", import.meta.url)), "studio"], {
  stdio: "inherit",
  env: { ...process.env, LOCAL_DB_PATH: url },
});
