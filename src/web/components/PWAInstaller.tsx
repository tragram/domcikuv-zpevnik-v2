import type { PWAInstallElement } from "@khmyznikov/pwa-install";
import { lazy, Suspense, useEffect } from "react";
import { create } from "zustand";

const PWAInstall = lazy(() => import("@khmyznikov/pwa-install/react-legacy"));
const useInstaller = create<{
  requested: boolean;
  element: PWAInstallElement | null;
  available: boolean;
}>(() => ({ requested: false, element: null, available: false }));

const setInstaller = (element: PWAInstallElement | null) => {
  useInstaller.setState({ element, available: element?.isInstallAvailable ?? false });
};

export function PWAInstaller() {
  const requested = useInstaller((state) => state.requested);
  if (import.meta.env.DEV || !requested) return null;

  // This library attaches window listeners for the lifetime of its element.
  // Keep a single instance through route changes.
  return (
    <Suspense fallback={null}>
      <PWAInstall
        disableChrome={false}
        disableClose={false}
        ref={setInstaller}
        icon="/icons/favicon.svg"
        name="Domčíkův Zpěvník"
        description="Druhá verze mého báječného zpěvníku - nyní offline!"
        onPwaInstallAvailableEvent={() => useInstaller.setState({ available: true })}
        onPwaInstallSuccessEvent={() => useInstaller.setState({ available: false })}
      />
    </Suspense>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePWAInstaller() {
  const { element, available } = useInstaller();
  useEffect(() => {
    if (import.meta.env.PROD && !useInstaller.getState().requested) {
      useInstaller.setState({ requested: true });
    }
  }, []);
  return { element, available };
}
