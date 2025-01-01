import React, { useRef, useState, useEffect } from 'react';
import PWAInstall from '@khmyznikov/pwa-install/react-legacy';
import { PWAInstallElement } from '@khmyznikov/pwa-install';
import { resolveAssetPath } from './song_loader';
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
                manifestUrl={resolveAssetPath('/manifest.json')}
                onPwaInstallAvailableEvent={(event) => { console.log(event); setInstallAvailable(true) }}
            />
        </>
    );
    return {
        showInstallPrompt,
        installNative,
        installAvailable,
        PWAInstallComponent,
        pwaInstallRef,
    };
};

export default usePWAInstall;