import { cn } from "~/lib/utils";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface Option<T extends string | number = string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface FancySwitchProps<T extends string | number> {
  options: Array<Option<T>>;
  selectedOption: T;
  setSelectedOption: (value: T) => void;
  roundedClass?: string;
  children?: ReactNode;
  vertical?: boolean;
  full?: boolean;
  hiddenHighlightOnOther?: boolean;
}

export default function FancySwitch<T extends string | number>({
  options,
  selectedOption,
  setSelectedOption,
  roundedClass = "",
  children,
  vertical = false,
  full = false,
  hiddenHighlightOnOther = false,
}: FancySwitchProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    opacity: 0, // Starts invisible so the initial state isn't an ugly box
  });

  const showHighlight = hiddenHighlightOnOther
    ? options.some((o) => o.value === selectedOption)
    : true;

  useEffect(() => {
    const updateHighlight = () => {
      if (!containerRef.current) return;

      const activeEl = containerRef.current.querySelector(
        '[data-active="true"]',
      ) as HTMLElement;

      if (activeEl) {
        setHighlight({
          left: activeEl.offsetLeft,
          top: activeEl.offsetTop,
          width: activeEl.offsetWidth,
          height: activeEl.offsetHeight,
          opacity: showHighlight ? 1 : 0,
        });
      }
    };

    updateHighlight();

    window.addEventListener("resize", updateHighlight);
    document.fonts.ready.then(updateHighlight);

    return () => window.removeEventListener("resize", updateHighlight);
  }, [selectedOption, showHighlight, options, vertical]);

  return (
    <div
      className={cn(
        "flex select-none rounded-full bg-white font-bold shadow-xs outline-2 outline-primary transition-all dark:bg-background/90 dark:outline-primary/30",
        "overflow-hidden",
        vertical ? "min-h-[40px] flex-col w-fit" : "h-[40px] flex-row",
        full && !vertical ? "w-full justify-center" : "w-fit",
      )}
    >
      <div
        ref={containerRef}
        className={cn(
          "relative flex h-full w-full text-sm text-primary",
          vertical ? "flex-col" : "flex-row",
          children && "pr-1",
        )}
      >
        <div
          className={cn(
            "absolute z-0 bg-primary h-full",
            // Clean, permanent transition. No hacky timeouts.
            "transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
            roundedClass,
          )}
          style={{
            transform: `translate(${highlight.left}px, ${highlight.top}px)`,
            width: `${highlight.width}px`,
            opacity: highlight.opacity,
          }}
        />

        {options.map((option) => {
          const isSelected = option.value === selectedOption;

          return (
            <button
              key={option.value}
              type="button"
              data-active={isSelected}
              onClick={() => setSelectedOption(option.value)}
              className={cn(
                "relative z-10 flex h-full shrink-0 items-center justify-center whitespace-nowrap outline-hidden transition-colors duration-200",
                vertical ? "px-3" : "px-4",
                isSelected && showHighlight
                  ? "text-white dark:text-white"
                  : "hover:dark:text-white",
              )}
            >
              <div className="flex items-center justify-center gap-2">
                {option.icon && (
                  <span className="fancy-switch-icon flex items-center justify-center">
                    {option.icon}
                  </span>
                )}
                <span className="fancy-switch-label">{option.label}</span>
              </div>
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}
