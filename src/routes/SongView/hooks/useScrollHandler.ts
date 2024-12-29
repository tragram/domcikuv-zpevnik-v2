import { useEffect, useRef, useState, useCallback } from "react";
import { FitScreenMode } from "./viewSettingsStore";

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
        setAtBottom(remainingContent <= 0);
    }, [fitScreenMode]);

    useEffect(() => {
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [handleScroll]);

    return { atBottom, isToolbarVisible };
};
