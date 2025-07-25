import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { ArrowBigDown, ArrowBigUpDash, Beaker } from "lucide-react";
import { useEffect, useState, memo } from "react";
import { animateScroll as scroll } from 'react-scroll';
import type { FitScreenMode } from "../hooks/viewSettingsStore";
import { useScrollHandler } from "../hooks/useScrollHandler";

interface ScrollButtonsProps {
    fitScreenMode: FitScreenMode;
}

// for some reason, this is barely
export const MAGICAL_FIREFOX_CONSTANT_PX = 10;

const ScrollButtons = memo(({ fitScreenMode }: ScrollButtonsProps) => {
    const [showScrollButtons, setShowScrollButtons] = useState(false);
    const { atBottom } = useScrollHandler(fitScreenMode);

    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            setShowScrollButtons(
                document.body.scrollHeight - MAGICAL_FIREFOX_CONSTANT_PX > window.outerHeight &&
                fitScreenMode !== "fitXY"
            );
        });
        resizeObserver.observe(document.body);
        return () => resizeObserver.disconnect();
    }, [fitScreenMode]);

    const scrollDown = () => {
        const remainingContent = document.body.scrollHeight - window.scrollY - window.outerHeight;
        const scrollSpeed = window.outerHeight / 2000; // whole screen in 2s 

        if (remainingContent <= 0) return;

        // If we're close to the bottom, scroll all the way
        if (remainingContent < 0.8 * window.outerHeight) {
            scroll.scrollToBottom({
                duration: remainingContent / scrollSpeed,
                onComplete: () => {
                    // Trigger a tiny native scroll to hide the UI in Firefox Mobile
                    window.scrollBy(0, -1);
                }
            });
            return;
        }

        // Try to find the next section first
        const sections = document.querySelectorAll('.section');
        for (const container of sections) {
            const rect = container.getBoundingClientRect();
            if (rect.bottom >= window.outerHeight) {
                const offset = Math.max(100, 0.2 * window.outerHeight);
                const scrollDist = rect.top - offset;
                if (scrollDist < 0.2 * window.outerHeight) {
                    break;
                }
                scroll.scrollTo(
                    rect.top + window.scrollY - offset,
                    { duration: scrollDist / scrollSpeed }
                );
                return;
            }
        }

        // If no section was found, scroll by viewport height
        const scrollDist = Math.min(window.outerHeight * 0.8, remainingContent);
        scroll.scrollTo(
            window.scrollY + scrollDist,
            { duration: scrollDist / scrollSpeed }
        );
    };

    const scrollUp = () => {
        scroll.scrollTo(0, { duration: 200 });
    };

    if (!showScrollButtons) return null;

    return (
        <div className="fixed bottom-10 right-10 z-50 h-24 flex">
            {!atBottom && (
                <Button
                    size="icon"
                    variant="circular"
                    onClick={scrollDown}
                    className="absolute bottom-0 right-0"
                >
                    <ArrowBigDown />
                </Button>
            )}
            {atBottom && (
                <Button
                    size="icon"
                    variant="circular"
                    onClick={scrollUp}
                    className="absolute top-0 right-0"
                >
                    <ArrowBigUpDash />
                </Button>
            )}
        </div>
    );
});

export default ScrollButtons;