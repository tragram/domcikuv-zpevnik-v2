import React from "react";
import { cn } from "@/lib/utils";

interface ToolbarBaseProps {
    children: React.ReactNode;
    className?: string;
    showToolbar?: boolean; // Controls whether the toolbar is visible
    scrollOffset?: number; // Current scroll offset
    fakeScroll?: boolean; // If true, fakes scrolling via translateY (for virtualized views)
}

const TOOLBAR_CONTAINER_H = 72; // Toolbar height in pixels

const ToolbarBase: React.FC<ToolbarBaseProps> = ({
    children,
    className = "",
    showToolbar = true,
    scrollOffset = 100,
    fakeScroll = false,
}) => {
    const partiallyVisible = scrollOffset <= TOOLBAR_CONTAINER_H; // Check if toolbar is partially visible
    let translateYPx: number = 0;
    let position: "fixed" | "relative" = "fixed";
    let opacity: string = "opacity-100";

    if (showToolbar) {
        translateYPx = 0;
    } else if (partiallyVisible && fakeScroll) {
        translateYPx = Math.min(Math.max(scrollOffset, 0), TOOLBAR_CONTAINER_H);
    } else if (partiallyVisible && !fakeScroll) {
        translateYPx = 0;
        position = "relative";
    } else {
        translateYPx = TOOLBAR_CONTAINER_H;
        if (scrollOffset <= 2 * TOOLBAR_CONTAINER_H && !fakeScroll) {
            opacity = "opacity-0"; // avoid toolbar briefly appearing on top
        }
    }

    return (
        <div
            className={cn(
                "flex justify-center w-full p-2 sm:p-4 z-30 toolbar-container",
                `h-[${TOOLBAR_CONTAINER_H}px]`,
                position,
                opacity,
                className
            )}
            style={{
                willChange: "transform",
                transform: `translateY(-${translateYPx}px)`,
                transition: partiallyVisible
                    ? "none" 
                    : "transform 500ms cubic-bezier(0.165, 0.840, 0.250, 1.040)", 
            }}
        >
            <div
                className="w-fit xs:w-full xl:w-fit h-14 bg-glass/10 backdrop-blur-md rounded-full shadow-md flex gap-2 p-2 items-center outline-primary dark:outline-primary/30 outline outline-2 justify-left"
                id="toolbar"
            >
                {children}
            </div>
        </div>
    );
};

export default ToolbarBase;
