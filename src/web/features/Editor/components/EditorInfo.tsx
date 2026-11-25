import { Info } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

export function EditorInfo({ label, children }: { label: string; children: ReactNode }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const contentClass = "max-w-[min(17rem,85vw)] rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-lg";
  return (
    <Popover open={pinned} onOpenChange={setPinned}>
      <TooltipProvider delayDuration={180}>
        <Tooltip open={!pinned && hovered} onOpenChange={setHovered}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button ref={trigger} type="button" aria-label={`About ${label}`}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                <Info aria-hidden className="size-3.5" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent className={contentClass}>{children}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent aria-label={`About ${label}`} collisionPadding={8} className={contentClass}
        onCloseAutoFocus={event => {
          // Returning keyboard focus to the icon must not reopen its hover hint.
          event.preventDefault();
          if (document.activeElement === document.body || (event.currentTarget instanceof HTMLElement && event.currentTarget.contains(document.activeElement))) {
            trigger.current?.focus();
          }
          setHovered(false);
        }}>{children}</PopoverContent>
    </Popover>
  );
}
