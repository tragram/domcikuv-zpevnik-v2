import { useEffect } from "react";
import { useViewSettingsStore } from "src/web/features/SongView/hooks/viewSettingsStore";
import { UserData } from "./use-user-data";

export function useEnableShareSessionAfterAuth(userData: UserData | undefined | null) {
  const shareSession = useViewSettingsStore((state) => state.shareSession);
  const setShareSession = useViewSettingsStore(
    (state) => state.actions.setShareSession,
  );

  useEffect(() => {
    if (userData?.profile?.nickname) {
      if (localStorage.getItem("enableShareSessionAfterAuth") === "true") {
        localStorage.removeItem("enableShareSessionAfterAuth");
        if (!shareSession) setShareSession(true);
      }
    }
  }, [userData?.profile?.nickname, shareSession, setShareSession]);

  const scheduleEnable = () => {
    localStorage.setItem("enableShareSessionAfterAuth", "true");
  };

  return { scheduleEnable };
}
