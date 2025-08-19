import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { account, session, user, verification } from "../db/schema";

export const auth = (
  env: Env,
  db: DrizzleD1Database
): ReturnType<typeof betterAuth> => {
  const baseURL = import.meta.env.DEV ? env.VITE_BASE_URL : env.PROD_BASE_URL;
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user,
        account,
        session,
        verification,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
    },
    user: {
      deleteUser: {
        enabled: true,
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
