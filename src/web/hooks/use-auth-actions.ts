import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { signOut } from "src/lib/auth/client";
import { toast } from "sonner";

export function useAuthActions() {
  const queryClient = useQueryClient();
  const router = useRouter();

  /**
   * Refreshes all data dependent on the user's identity.
   * Clears the profile, songs (for favorites), and public songbooks.
   */
  const refreshAuth = async (isLogout = false) => {
    // 1. Invalidate profile data
    await queryClient.invalidateQueries({ queryKey: ["userProfile"] });

    // 2. Clear songs and songbooks since they depend on user favorites
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["songs"] }),
      queryClient.invalidateQueries({ queryKey: ["publicSongbooks"] }),
    ]);

    if (isLogout) {
      // Completely remove sensitive data to prevent "flash" of old state
      queryClient.removeQueries({ queryKey: ["userProfile"] });
    }

    // 3. Force the router to re-run 'beforeLoad' and loaders
    await router.invalidate();
  };

  const logout = async (redirectURL?: string) => {
    try {
      await signOut({
        fetchOptions: {
          onSuccess: async () => {
            await refreshAuth(true);
            if (redirectURL) {
              router.navigate({ to: redirectURL });
            }
            toast.success("Logged out successfully");
          },
        },
      });
    } catch (err) {
      toast.error("Error during logout");
      console.error("Logout error:", err);
    }
  };

  return { refreshAuth, logout };
}
