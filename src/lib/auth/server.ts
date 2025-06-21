import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { account, session, user, verification } from "../db/schema";

export const auth = (db: DrizzleD1Database) => {
  const baseURL = import.meta.env.DEV
    ? process.env.VITE_BASE_URL
    : process.env.PROD_BASE_URL;
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
    secret: process.env.BETTER_AUTH_SECRET,
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
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectURI: baseURL + "/api/auth/callback/google",
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        redirectURI: baseURL + "/api/auth/callback/github",
      },
    },
  });
};
