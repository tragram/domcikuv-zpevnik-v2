import { PWAInstallElement } from '@khmyznikov/pwa-install';
import PWAInstall from '@khmyznikov/pwa-install/react-legacy';
import { Save } from 'lucide-react';
import { useRef, useState } from 'react';
import { DropdownIconStart, DropdownMenuItem } from './ui/dropdown-menu';

export const usePWAInstall = () => {
    const pwaInstallRef = useRef<PWAInstallElement>(null);
    const [installAvailable, setInstallAvailable] = useState(false);
    
    // Disable PWA install functionality during development
    const isDevelopment = import.meta.env.DEV;

    // Function to show the install prompt
    const showInstallPrompt = () => {
        if (isDevelopment) {
            console.log('PWA install disabled in development mode');
            return;
        }
        
        if (pwaInstallRef.current) {
            pwaInstallRef.current.showDialog();
        }
    };

    const installNative = () => {
        if (isDevelopment) {
            console.log('PWA install disabled in development mode');
            return;
        }

        if (pwaInstallRef.current) {
            pwaInstallRef.current.install();
        }
    }

    // Only render PWA component in production
    const PWAInstallComponent = isDevelopment ? null : (
        <>
            <PWAInstall
                disableChrome={false}
                disableClose={false}
                ref={pwaInstallRef}
                icon={"/icons/favicon.svg"}
                name={"Domčíkův Zpěvník"}
                description='Druhá verze mého báječného zpěvníku - nyní offline!'
                onPwaInstallAvailableEvent={() => { setInstallAvailable(true) }}
            />
        </>
    );

    let installItem;
    
    // In development, show a disabled state or hide completely
    if (isDevelopment) {
        installItem = (
            <DropdownMenuItem disabled>
                <DropdownIconStart icon={<Save />} />
                <span className="text-muted-foreground text-[10px]">Install disabled in dev mode</span>
            </DropdownMenuItem>
        );
    } else if (pwaInstallRef.current) {
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
        installAvailable: isDevelopment ? false : installAvailable,
        PWAInstallComponent,
        pwaInstallRef,
        installItem
    };
};

export default usePWAInstall;