import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { authClient } from "src/lib/auth/client";
import { YOUTUBE_PLAYLIST_MAX, YOUTUBE_PLAYLIST_SCOPE } from "src/lib/youtube";
import { ApiException } from "~/services/api-service";
import { createYoutubePlaylist } from "~/services/editor-service";

const PENDING_EXPORT_KEY = "pendingYoutubePlaylistExport";

const isAuthOrScopeError = (e: unknown): e is ApiException =>
  e instanceof ApiException &&
  (e.code === "AUTH_REQUIRED" || e.code === "GOOGLE_YOUTUBE_SCOPE_REQUIRED");

/**
 * Exporting requires the `youtube` OAuth scope on the user's Google account.
 * When the worker reports it's missing, we stash the pending video ids and
 * send the user through Google's consent screen — which navigates away and
 * back, so the in-memory selection would otherwise be lost. On return, the
 * effect below picks the stashed ids back up and finishes the export.
 */
export function useYoutubeExport() {
  const [isExporting, setIsExporting] = useState(false);
  const exportingRef = useRef(false);

  const exportPlaylist = useCallback(
    async (
      videoIds: string[],
      { resumed = false, title }: { resumed?: boolean; title?: string } = {},
    ) => {
      const ids = videoIds.slice(0, YOUTUBE_PLAYLIST_MAX);
      if (ids.length === 0 || exportingRef.current) return;

      exportingRef.current = true;
      setIsExporting(true);
      // Open the tab synchronously inside the click gesture so it isn't
      // blocked as a popup. A resumed export runs on page load with no
      // gesture, so it would be blocked anyway — don't even try.
      const tab = resumed ? null : window.open("about:blank", "_blank");
      try {
        const { url, addedCount, failedCount, quotaExhausted } =
          await createYoutubePlaylist(ids, title);
        const notify = quotaExhausted ? toast.warning : toast.success;
        const summary = quotaExhausted
          ? `Daily YouTube limit reached — only ${addedCount} of ${addedCount + failedCount} videos made it in. Try again tomorrow.`
          : failedCount > 0
            ? `Added ${addedCount} of ${addedCount + failedCount} videos — some couldn't be added.`
            : `Added ${addedCount} video${addedCount === 1 ? "" : "s"} to your YouTube playlist.`;
        if (tab) {
          tab.location.href = url;
          notify(summary, { duration: quotaExhausted ? 15000 : undefined });
        } else {
          // No pre-opened tab (resumed export, or popup blocked): opening from
          // the toast's click gesture is never popup-blocked.
          notify(summary, {
            duration: 15000,
            action: {
              label: "Open playlist",
              onClick: () =>
                void window.open(url, "_blank", "noopener,noreferrer"),
            },
          });
        }
      } catch (e) {
        tab?.close();
        if (isAuthOrScopeError(e)) {
          // Redirect through Google consent at most once: if we came back
          // from it and the scope is still missing, redirecting again would
          // loop forever — surface the failure instead.
          if (resumed) {
            toast.error(
              "Google didn't grant YouTube access — playlist export needs it. Please try again.",
            );
            return;
          }
          sessionStorage.setItem(
            PENDING_EXPORT_KEY,
            JSON.stringify({ ids, title }),
          );
          const googleAuthOptions = {
            provider: "google" as const,
            scopes: [YOUTUBE_PLAYLIST_SCOPE],
            callbackURL: window.location.href,
          };
          if (e.code === "AUTH_REQUIRED") {
            await authClient.signIn.social(googleAuthOptions);
          } else {
            await authClient.linkSocial(googleAuthOptions);
          }
          return;
        }
        console.error("Failed to create YouTube playlist", e);
        toast.error(
          e instanceof ApiException
            ? e.message
            : "Couldn't create the playlist. Please try again.",
        );
      } finally {
        exportingRef.current = false;
        setIsExporting(false);
      }
    },
    [],
  );

  useEffect(() => {
    const raw = sessionStorage.getItem(PENDING_EXPORT_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_EXPORT_KEY);
    try {
      const pending: unknown = JSON.parse(raw);
      const { ids, title } = (pending ?? {}) as {
        ids?: unknown;
        title?: unknown;
      };
      if (
        Array.isArray(ids) &&
        ids.length > 0 &&
        ids.every((id) => typeof id === "string")
      ) {
        void exportPlaylist(ids, {
          resumed: true,
          title: typeof title === "string" ? title : undefined,
        });
      }
    } catch {
      /* malformed sessionStorage value — ignore */
    }
    // Deliberately run once on mount to resume a pending export after the
    // Google consent redirect; exportPlaylist itself has stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isExporting, exportPlaylist };
}
