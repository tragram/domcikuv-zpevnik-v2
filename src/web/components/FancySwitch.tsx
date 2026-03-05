import { cn } from "~/lib/utils";
import { FancySwitch as FancySwitchBase } from "@omit/react-fancy-switch";
import { ComponentProps, useEffect, useState, type ReactNode } from "react";

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
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const showHighlight = hiddenHighlightOnOther
    ? options.some((o) => o.value === selectedOption)
    : true;

  return (
    <div
      className={cn(
        "flex h-[40px] select-none rounded-full bg-white font-bold shadow-xs outline-2 outline-primary transition-all dark:bg-background/90 dark:outline-primary/30",
        full ? "w-full justify-center" : "w-fit",
      )}
    >
      <FancySwitchBase
        options={
          options as unknown as ComponentProps<
            typeof FancySwitchBase
          >["options"]
        }
        value={selectedOption}
        onChange={(val) => {
          if (val !== undefined) {
            setSelectedOption(val as T);
          }
        }}
        className={cn(
          "flex h-full w-fit text-sm text-primary",
          children && "pr-1",
          vertical && "flex-col py-2",
        )}
        highlighterClassName={cn(
          "h-full transition-none",
          roundedClass,
          showHighlight ? "bg-primary" : "bg-transparent",
        )}
        radioClassName="relative mx-2 flex h-full cursor-pointer items-center justify-center rounded-full px-3.5 text-sm text-primary-foreground transition-colors focus:outline-hidden data-[checked]:text-primary-foreground"
        highlighterIncludeMargin={true}
        highlighterStyle={{ transitionProperty: animated ? "all" : "none" }}
        renderOption={({ option, isSelected, getOptionProps }) => {
          // Tell TS this isn't just the base library's option, it's ours!
          const customOption = option as unknown as Option<T>;

          return (
            <div
              {...getOptionProps()}
              className={cn(
                "z-50 flex items-center justify-center gap-2 hover:dark:text-white",
                vertical ? "px-3" : "px-4",
                isSelected && showHighlight && "text-white dark:text-white",
                customOption.value === options[options.length - 1]?.value &&
                  "rounded-full",
              )}
            >
              {customOption.icon && (
                <span className="fancy-switch-icon">{customOption.icon}</span>
              )}
              <span className="fancy-switch-label">{customOption.label}</span>
            </div>
          );
        }}
      />
      {children}
    </div>
  );
}
