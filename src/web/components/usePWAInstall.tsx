import { Save } from "lucide-react";
import { DropdownMenuItem } from "./ui/dropdown-menu";
import { CompactItem } from "./RichDropdown";
import { usePWAInstaller } from "./PWAInstaller";

export default function usePWAInstall() {
  const { element, available } = usePWAInstaller();

  if (!import.meta.env.DEV && !element) return null;

  const isApple = element?.isAppleDesktopPlatform || element?.isAppleMobilePlatform;
  const title = import.meta.env.DEV
    ? "Install disabled in dev mode"
    : isApple
      ? "How to install"
      : available
        ? "Install app"
        : "Install";
  const subtitle = !import.meta.env.DEV && !isApple && !available
    ? "Use Safari (iOS) or Chrome (otherwise) to install the app."
    : undefined;

  return (
    <DropdownMenuItem
      disabled={import.meta.env.DEV || (!isApple && !available)}
      onClick={() => {
        if (isApple) element?.showDialog();
        else element?.install();
      }}
    >
      <CompactItem.Shell>
        <CompactItem.Icon>
          <Save />
        </CompactItem.Icon>
        <CompactItem.Body title={title} subtitle={subtitle} subtitleClass="line-clamp-none" />
      </CompactItem.Shell>
    </DropdownMenuItem>
  );
}
