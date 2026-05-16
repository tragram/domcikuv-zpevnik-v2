import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useUserData } from "~/hooks/use-user-data";
import { makeApiRequest } from "~/services/api-service";
import { activeSessionsQueryOptions } from "~/hooks/use-active-sessions";
import { useViewSettingsStore } from "./viewSettingsStore";
import client from "src/worker/api-client";

export function useShareSessionToggle() {
  const queryClient = useQueryClient();
  const { userData } = useUserData();
  const shareSession = useViewSettingsStore((state) => state.shareSession);
  const setShareSession = useViewSettingsStore((state) => state.actions.setShareSession);

  const toggleShareSession = useCallback(
    async (checked: boolean) => {
      setShareSession(checked);
      if (!checked && userData) {
        const masterNickname = userData.profile.nickname || userData.profile.name;
        if (masterNickname) {
          // Optimistic update
          queryClient.setQueryData(activeSessionsQueryOptions().queryKey, (old) => {
            if (!old) return old;
            return old.filter((s) => s.masterId !== userData.profile.id);
          });

          try {
            await makeApiRequest(() =>
              client.api.session[":masterNickname"].$post({
                param: { masterNickname },
                json: { songId: null },
              }),
            );
          } catch (e) {
            console.error("Failed to end session on backend", e);
          }
        }
      }
    },
    [setShareSession, userData, queryClient],
  );

  return { shareSession, toggleShareSession };
}
