import { useEffect, useState } from "react";
import { FitScreenMode } from "./viewSettingsStore";

export const useScrollHandler = (fitScreenMode: FitScreenMode, setVisibleToolbar: (value: boolean) => void) => {
    const [prevScrollPos, setPrevScrollPos] = useState(0);
    const [atBottom, setAtBottom] = useState(false);
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollPos = window.scrollY;
            // TODO: this is different
            if (currentScrollPos > prevScrollPos) {
                if (fitScreenMode !== "fitXY") {
                    setVisibleToolbar(false);
                }
            } else if (currentScrollPos < prevScrollPos - 10) {
                 // -10 to "debounce" weird stuttering
                setVisibleToolbar(true);
                setAtBottom(false);
            }
            setPrevScrollPos(currentScrollPos);

            const remainingContent = document.body.scrollHeight - window.scrollY - screen.height;
            setAtBottom(remainingContent <= 0);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [fitScreenMode, prevScrollPos, setVisibleToolbar]);

    return { atBottom };
};
