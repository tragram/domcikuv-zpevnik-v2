import { PWAInstallElement } from "@khmyznikov/pwa-install";
import PWAInstall from "@khmyznikov/pwa-install/react-legacy";
import { Save } from "lucide-react";
import { useRef, useState } from "react";
import { DropdownMenuItem } from "./ui/dropdown-menu";
import { CompactItem } from "./RichDropdown";

export const usePWAInstall = () => {
  const pwaInstallRef = useRef<PWAInstallElement>(null);
  const [installAvailable, setInstallAvailable] = useState(false);

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
        ref={pwaInstallRef}
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
  } else if (pwaInstallRef.current) {
    const PWAInstall = pwaInstallRef.current;
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
