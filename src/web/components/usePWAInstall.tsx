import { PWAInstallElement } from "@khmyznikov/pwa-install";
import PWAInstall from "@khmyznikov/pwa-install/react-legacy";
import { Save } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { DropdownMenuItem } from "./ui/dropdown-menu";
import { CompactItem } from "./RichDropdown";

export const usePWAInstall = () => {
  const pwaInstallRef = useRef<PWAInstallElement>(null);
  const [installAvailable, setInstallAvailable] = useState(false);
  // Mirror the web-component instance into state so render stays reactive and
  // doesn't read the ref during render (populated once the element is ready).
  const [pwaInstall, setPwaInstall] = useState<PWAInstallElement | null>(null);

  const setPwaInstallRef = useCallback((el: PWAInstallElement | null) => {
    pwaInstallRef.current = el;
    setPwaInstall(el);
  }, []);

  const isDevelopment = import.meta.env.DEV;

  const showInstallPrompt = () => {
    if (isDevelopment) {
      console.log("PWA install disabled in development mode");
      return;
    }
    if (pwaInstallRef.current) {
      pwaInstallRef.current.showDialog();
    }
  };

  const installNative = () => {
    if (isDevelopment) {
      console.log("PWA install disabled in development mode");
      return;
    }
    if (pwaInstallRef.current) {
      pwaInstallRef.current.install();
    }
  };

  const PWAInstallComponent = isDevelopment ? null : (
    <>
      <PWAInstall
        disableChrome={false}
        disableClose={false}
        ref={setPwaInstallRef}
        icon={"/icons/favicon.svg"}
        name={"Domčíkův Zpěvník"}
        description="Druhá verze mého báječného zpěvníku - nyní offline!"
        onPwaInstallAvailableEvent={() => {
          setInstallAvailable(true);
        }}
      />
    </>
  );

  let installItem;

  if (isDevelopment) {
    installItem = (
      <DropdownMenuItem disabled>
        <CompactItem.Shell>
          <CompactItem.Icon>
            <Save />
          </CompactItem.Icon>
          <CompactItem.Body title="Install disabled in dev mode" />
        </CompactItem.Shell>
      </DropdownMenuItem>
    );
  } else if (pwaInstall) {
    const PWAInstall = pwaInstall;
    if (PWAInstall.isAppleDesktopPlatform || PWAInstall.isAppleMobilePlatform) {
      installItem = (
        <DropdownMenuItem onClick={showInstallPrompt}>
          <CompactItem.Shell>
            <CompactItem.Icon>
              <Save />
            </CompactItem.Icon>
            <CompactItem.Body title="How to install" />
          </CompactItem.Shell>
        </DropdownMenuItem>
      );
    } else if (PWAInstall.isInstallAvailable) {
      installItem = (
        <DropdownMenuItem onClick={installNative}>
          <CompactItem.Shell>
            <CompactItem.Icon>
              <Save />
            </CompactItem.Icon>
            <CompactItem.Body title="Install app" />
          </CompactItem.Shell>
        </DropdownMenuItem>
      );
    } else {
      installItem = (
        <DropdownMenuItem disabled>
          <CompactItem.Shell>
            <CompactItem.Icon>
              <Save />
            </CompactItem.Icon>
            <CompactItem.Body title="Use Safari (iOS) or Chrome (otherwise) to install the app." />
          </CompactItem.Shell>
        </DropdownMenuItem>
      );
    }
  }

  return {
    showInstallPrompt,
    installNative,
    installAvailable: isDevelopment ? false : installAvailable,
    PWAInstallComponent,
    pwaInstallRef,
    installItem,
  };
};

export default usePWAInstall;
