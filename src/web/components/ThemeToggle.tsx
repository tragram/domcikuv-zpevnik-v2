import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "~/components/shadcn-ui/button";
import { useTheme } from "./ThemeProvider";
import { DropdownMenuItem } from "./shadcn-ui/dropdown-menu";

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
    >
      <SunIcon className="mr-1 h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <MoonIcon className="absolute mr-1 h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <div className="inline dark:hidden">Light theme</div>
      <div className="hidden dark:inline">Dark theme</div>
    </DropdownMenuItem>
  );
}
