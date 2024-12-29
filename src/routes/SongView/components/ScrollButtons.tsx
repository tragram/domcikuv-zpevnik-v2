
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowBigDown, ArrowBigUpDash } from "lucide-react";
import { useEffect, useState, memo } from "react";
import { animateScroll as scroll } from 'react-scroll';
import { FitScreenMode } from "../hooks/viewSettingsStore";
import { useScrollHandler } from "../hooks/useScrollHandler";

interface ScrollButtonsProps {
    fitScreenMode: FitScreenMode;
}

const ScrollButtons = memo(({ fitScreenMode }: ScrollButtonsProps) => {
    const [showScrollButtons, setShowScrollButtons] = useState(false);
    const { atBottom } = useScrollHandler(fitScreenMode);

    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            setShowScrollButtons(
                document.body.scrollHeight > screen.height && 
                fitScreenMode != "fitXY"
            );
        });
        
        resizeObserver.observe(document.body);
        return () => resizeObserver.disconnect();
    }, [fitScreenMode]);

    const scrollDown = () => {
        const remainingContent = document.body.scrollHeight - window.scrollY - screen.height;
        const scrollSpeed = screen.height / 2000; // whole screen in 2s 
        
        if (remainingContent < 0) return;
        
        if (remainingContent < 0.8 * screen.height) {
            scroll.scrollToBottom({
                duration: remainingContent / scrollSpeed,
                onComplete: () => {
                    // Trigger a tiny native scroll to hide the UI in Firefox Mobile
                    window.scrollBy(0, -1);
                }
            });
            return;
        }
        
        const sections = document.querySelectorAll('.section');
        for (const container of sections) {
            const rect = container.getBoundingClientRect();
            if (rect.bottom >= screen.height) {
                const offset = Math.max(100, 0.2 * screen.height);
                const scrollDist = rect.top - offset;
                scroll.scrollTo(
                    rect.top + window.scrollY - offset, 
                    { duration: scrollDist / scrollSpeed }
                );
                break;
            }
        }
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