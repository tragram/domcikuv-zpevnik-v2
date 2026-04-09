import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { AppDatabase } from "../../worker/api/utils";
import { account, session, user, verification } from "../db/schema";

export const auth = (env: Env, db: AppDatabase) => {
  const baseURL = import.meta.env.DEV ? env.VITE_BASE_URL : env.PROD_BASE_URL;

  return betterAuth({
    baseURL,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: { user, account, session, verification },
    }),
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
    },
    user: {
      deleteUser: {
        enabled: true,
      },
      additionalFields: {
        nickname: { type: "string", required: false },
        isFavoritesPublic: {
          type: "boolean",
          required: false,
          defaultValue: false,
        },
        isAdmin: { type: "boolean", required: false, defaultValue: false },
        isTrusted: { type: "boolean", required: false, defaultValue: false },
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectURI: baseURL + "/api/auth/callback/google",
      },
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        redirectURI: baseURL + "/api/auth/callback/github",
      },
    },
  });
};
