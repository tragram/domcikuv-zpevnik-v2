import { PWAInstallElement } from '@khmyznikov/pwa-install';
import PWAInstall from '@khmyznikov/pwa-install/react-legacy';
import { Save } from 'lucide-react';
import { useRef, useState } from 'react';
import { resolveAssetPath } from './song_loader';
import { DropdownIconStart, DropdownMenuItem } from './ui/dropdown-menu';
export const usePWAInstall = () => {
    const pwaInstallRef = useRef<PWAInstallElement>(null);
    const [installAvailable, setInstallAvailable] = useState(false);
    // Function to show the install prompt
    const showInstallPrompt = () => {
        if (pwaInstallRef.current) {
            pwaInstallRef.current.showDialog();
        }
    };

    const installNative = () => {

        if (pwaInstallRef.current) {
            pwaInstallRef.current.install();
        }
    }
    const PWAInstallComponent = (
        <>
            <PWAInstall
                disableChrome={false}
                disableClose={false}
                ref={pwaInstallRef}
                // manifestUrl={resolveAssetPath('manifest.json')} // this appears to be currently broken...
                icon={resolveAssetPath("assets/icons/favicon.svg")}
                name={"Domčíkův Zpěvník"}
                description='Druhá verze mého báječného zpěvníku - nyní offline!'
                // onPwaInstallAvailableEvent={(event) => { console.log(event); setInstallAvailable(true) }}
                onPwaInstallAvailableEvent={() => { setInstallAvailable(true) }}
            />
        </>
    );

    let installItem;
    if (pwaInstallRef.current) {
        const PWAInstall = pwaInstallRef.current;
        if (PWAInstall.isAppleDesktopPlatform || PWAInstall.isAppleMobilePlatform) {
            // Safari on iOS/MacOS
            installItem = (
                <DropdownMenuItem
                    onClick={showInstallPrompt}
                >
                    <DropdownIconStart icon={<Save />} />
                    How to install
                </DropdownMenuItem>
            )
        } else if (PWAInstall.isInstallAvailable) {
            // Chrome on Android/Windows(/maybe Linux)
            installItem = (
                <DropdownMenuItem
                    onClick={installNative}
                >
                    <DropdownIconStart icon={<Save />} />
                    Install app
                </DropdownMenuItem>
            )
        } else {
            installItem = (
                <DropdownMenuItem
                >
                    <DropdownIconStart icon={<Save />} />
                        <p className='text-[0.7em] leading-tight'>Use Safari (iOS) or Chrome (otherwise) to install the app.</p>
                </DropdownMenuItem>
            )
        }
    }
    return {
        showInstallPrompt,
        installNative,
        installAvailable,
        PWAInstallComponent,
        pwaInstallRef,
        installItem
    };
};

export default usePWAInstall;