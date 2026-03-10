import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useTheme } from "./ThemeProvider";
import { DropdownMenuItem } from "./ui/dropdown-menu";
import { RichItem, CompactItem } from "./RichDropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="circular"
          size="icon"
          type="button"
          onClick={toggleTheme}
        >
          <SunIcon className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <MoonIcon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Toggle theme</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function DropdownThemeToggle({ size = 8 }: { size?: number }) {
  const { theme, setTheme } = useTheme();

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  // Dynamically select the layout style
  const Item = size <= 6 ? CompactItem : RichItem;

  return (
    <DropdownMenuItem
      onClick={toggleTheme}
      onSelect={(e) => e.preventDefault()}
      className="cursor-pointer w-full"
    >
      <Item.Shell>
        <Item.Icon size={size}>
          <SunIcon className="absolute transition-all scale-100 rotate-0 dark:scale-0 dark:-rotate-90" />
          <MoonIcon className="absolute transition-all scale-0 rotate-90 dark:scale-100 dark:rotate-0" />
        </Item.Icon>
        <Item.Body
          title={theme === "dark" ? "Dark theme" : "Light theme"}
          subtitle={
            theme === "dark" ? "Good choice!" : "Dark theme looks better ;-)"
          }
        />
      </Item.Shell>
    </DropdownMenuItem>
  );
}
