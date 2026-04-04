import { createAuthClient } from "better-auth/react";
import { queryClient } from "../query-client";

const authClient = createAuthClient({});

export async function refreshAuth() {
  // after login
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["userProfile"] }),
    queryClient.invalidateQueries({ queryKey: ["songs"] }),
    queryClient.invalidateQueries({ queryKey: ["songs-meta"] }),
  ]);
}

export async function refreshProfile() {
  // after changes to profile
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["userProfile"] }),
  ]);
}

export async function logoutUser() {
  await authClient.signOut();

  await Promise.all([
    queryClient.resetQueries({ queryKey: ["userProfile"] }),
    queryClient.resetQueries({ queryKey: ["songs"] }),
    queryClient.resetQueries({ queryKey: ["songs-meta"] }),
  ]);
}

// a wrapper to intercept Better Auth methods
const withRefreshAuth = <T extends object>(authModule: T): T => {
  return new Proxy(authModule, {
    get(target, prop) {
      const originalMethod = (target as any)[prop];

      if (typeof originalMethod === "function") {
        return async (...args: any[]) => {
          // Call the original better-auth method (e.g., signIn.email)
          const result = await originalMethod(...args);

          // Better Auth returns { data, error } pattern.
          // If the request was successful, trigger the refresh.
          if (result && !result.error) {
            await refreshAuth();
          }

          return result;
        };
      }

      return originalMethod;
    },
  });
};

export const signIn = withRefreshAuth(authClient.signIn);
export const signUp = withRefreshAuth(authClient.signUp);

export const { useSession, deleteUser } = authClient;
