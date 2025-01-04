import { useEffect, useRef, useState, useCallback } from "react";
import { FitScreenMode } from "./viewSettingsStore";
import { MAGICAL_FIREFOX_CONSTANT_PX } from "../components/ScrollButtons";

export const useScrollHandler = (fitScreenMode: FitScreenMode) => {
    const prevScrollPos = useRef(0);
    const [atBottom, setAtBottom] = useState(false);
    const [isToolbarVisible, setIsToolbarVisible] = useState(true);

    const handleScroll = useCallback(() => {
        const currentScrollPos = window.scrollY;

        if (currentScrollPos < 0) {
            setIsToolbarVisible(true);
            return;
        }

        if (currentScrollPos > prevScrollPos.current) {
            if (fitScreenMode !== "fitXY") {
                setIsToolbarVisible(false);
            }
        } else if (currentScrollPos < prevScrollPos.current - 10) {
            setIsToolbarVisible(true);
            setAtBottom(false);
        }

        prevScrollPos.current = currentScrollPos;

        const remainingContent = document.body.scrollHeight - window.scrollY - window.innerHeight;
        // Firefox on Android sometimes scrolls so that the remaining content is like 0.6, so checking against 0 does not work...
        setAtBottom(remainingContent <= MAGICAL_FIREFOX_CONSTANT_PX);
    }, [fitScreenMode]);

    useEffect(() => {
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [handleScroll]);

    return { atBottom, isToolbarVisible };
};
