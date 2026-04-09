import { createAuthClient } from "better-auth/react";
import { queryClient } from "../query-client";
import type { User, Session } from "better-auth";

export interface AppUser extends User {
  nickname?: string | null;
  isFavoritesPublic?: boolean | null;
  isAdmin?: boolean | null;
  isTrusted?: boolean | null;
}

export interface StandardAuthResponse {
  user: AppUser;
  session: Session;
}

export async function logoutUser() {
  await authClient.signOut();

  queryClient.removeQueries({ queryKey: ["favorites"] });
  queryClient.removeQueries({ queryKey: ["submissions"] });

  queryClient.setQueryData(["session"], null);
}

export const authClient = createAuthClient();

export const { signIn, signUp, useSession, deleteUser } = authClient;
