import React from "react";
import { cn } from "@/lib/utils";

interface ToolbarBaseProps {
    children: React.ReactNode;
    className?: string;
    childContainerClassName?: string;
    showToolbar?: boolean;
    scrollOffset?: number;
    fakeScroll?: boolean;
}

const TOOLBAR_CONTAINER_H = 88;

const ToolbarBase: React.FC<ToolbarBaseProps> = ({
    children,
    className = "",
    childContainerClassName = "",
    showToolbar = true,
    scrollOffset = 100,
    fakeScroll = false,
}) => {
    const partiallyVisible = scrollOffset <= TOOLBAR_CONTAINER_H;
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
            opacity = "opacity-0";
        }
    }

    // Only apply transition when:
    // 1. Toggling toolbar visibility (showToolbar changes)
    // 2. Not during active scrolling (either fake or real)
    const shouldTransition = (showToolbar || !partiallyVisible) && position === "fixed";

    return (
        <div
            className={cn(
                "flex justify-center w-full p-2 sm:p-4 z-30 toolbar-container",
                position,
                opacity,
                className
            )}
            style={{
                willChange: "transform",
                transform: `translateY(-${translateYPx}px)`,
                transition: shouldTransition
                    ? "transform 500ms cubic-bezier(0.165, 0.840, 0.250, 1.040)"
                    : "none",
            }}
        >
            <div
                className={cn("w-full xl:w-fit bg-glass/30 dark:bg-glass/10 backdrop-blur-md rounded-full shadow-md flex gap-2 p-2 items-center outline-primary dark:outline-primary/30 outline-2 justify-center", `h-[${40}px]`)}
                id="toolbar"
            >
                <div className={cn("flex flex-row gap-2 w-full h-full justify-left",childContainerClassName)}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default ToolbarBase;