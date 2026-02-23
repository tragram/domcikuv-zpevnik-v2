import React from "react";
import { cn } from "~/lib/utils";

interface ToolbarBaseProps {
  children: React.ReactNode;
  className?: string;
  childContainerClassName?: string;
  isVisible?: boolean;
}

const ToolbarBase: React.FC<ToolbarBaseProps> = ({
  children,
  className = "",
  childContainerClassName = "",
  isVisible = true,
}) => {
  return (
    <div
      className={cn(
        "toolbar-container fixed top-0 left-0 right-0 flex justify-center w-full p-2 sm:p-4 z-30 transition-transform duration-300 ease-in-out",
        isVisible ? "translate-y-0" : "-translate-y-full ",
        className,
      )}
      style={{ willChange: "transform" }}
    >
      <div
        className={cn(
          "w-full xl:w-fit bg-glass/30 dark:bg-glass/10 backdrop-blur-md rounded-full shadow-md flex gap-2 p-2 items-center outline-primary dark:outline-primary/30 outline-2 justify-center h-full",
        )}
        id="toolbar"
      >
        <div
          className={cn(
            "flex flex-row gap-2 w-full h-full justify-left",
            childContainerClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default ToolbarBase;
