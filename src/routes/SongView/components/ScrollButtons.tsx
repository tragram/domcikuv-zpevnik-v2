import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useScrollHandler } from "../hooks/useScrollHandler";
import { ArrowBigDown, ArrowBigUpDash } from "lucide-react";
import { cn } from "@/lib/utils";
import { animateScroll as scroll } from 'react-scroll';
import { FitScreenMode } from "../hooks/viewSettingsStore";

const ScrollButtons: React.FC<{ fitScreenMode: FitScreenMode, setVisibleToolbar: (value: boolean) => void, atBottom: boolean }> = ({ fitScreenMode, setVisibleToolbar, atBottom }) => {
    const [showScrollButtons, setShowScrollButtons] = useState(false);
    
    const resizeObserver = new ResizeObserver((entries) => {
        setShowScrollButtons(document.body.scrollHeight > screen.height && fitScreenMode != "fitXY");
    })
    resizeObserver.observe(document.body);

    const scrollDown = () => {
        // if (scrollInProgress) return;
        // if the rest can fit on the next screen --> scroll all the way
        const remainingContent = document.body.scrollHeight - window.scrollY - screen.height;
        const scrollSpeed = screen.height / 2000 // whole screen in 2s 
        if (remainingContent < 0) {
            return;
        }
        if (remainingContent < 0.8 * screen.height) {
            scroll.scrollToBottom({
                // why *10? IDK, the same scroll speed looks bad, possibly due to the easings...
                duration: remainingContent / (scrollSpeed), onComplete: () => {
                    // Trigger a tiny native scroll to hide the UI in Firefox Mobile
                    window.scrollBy(0, -1);
                }
            });
            return;
        }
        const sections = document.querySelectorAll('.section');
        // Find the next container that is not fully visible
        for (const container of sections) {
            const rect = container.getBoundingClientRect();
            // Check if the container is not fully visible within the viewport
            if (rect.bottom >= screen.height) {
                // Scroll this container into view and exit the loop
                const offset = Math.max(100, 0.2 * screen.height);
                const scrollDist = rect.top - offset;
                scroll.scrollTo(rect.top + window.scrollY - offset, { duration: scrollDist / scrollSpeed });
                break;
            }
        }
    };
    // return "scroll-down" animation is still running (even when it's scrolled down - buggy library)
    const scrollUp = () => {
        // if (scrollInProgress) return;
        scroll.scrollTo(0, { duration: 200 });
    };

    return (
        <div className={cn("fixed bottom-10 right-10 z-50 h-24 ", showScrollButtons ? "flex" : "hidden")}>
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
};

export default ScrollButtons;