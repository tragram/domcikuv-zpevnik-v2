import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useTheme } from "./ThemeProvider";
import { DropdownMenuItem } from "./ui/dropdown-menu";
import { RichItem } from "./RichDropdown";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  function toggleTheme() {
    if (theme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  }

  return (
    <Button variant="circular" size="icon" type="button" onClick={toggleTheme}>
      <SunIcon className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <MoonIcon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
    </Button>
  );
}

export function DropdownThemeToggle() {
  const { theme, setTheme } = useTheme();

  function toggleTheme() {
    if (theme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  }

  return (
    <DropdownMenuItem
      onClick={toggleTheme}
      onSelect={(e) => e.preventDefault()}
      className="py-2 cursor-pointer w-full"
    >
      <RichItem.Shell>
        <RichItem.Icon>
          <div className="relative flex items-center justify-center w-4 h-4">
            <SunIcon className="absolute h-4 w-4 transition-all scale-100 rotate-0 dark:scale-0 dark:-rotate-90" />
            <MoonIcon className="absolute h-4 w-4 transition-all scale-0 rotate-90 dark:scale-100 dark:rotate-0" />
          </div>
        </RichItem.Icon>
        <RichItem.Body
          title={theme === "dark" ? "Dark theme" : "Light theme"}
          subtitle={
            theme === "dark" ? "Good choice!" : "Dark theme looks better ;-)"
          }
        />
      </RichItem.Shell>
    </DropdownMenuItem>
  );
}
