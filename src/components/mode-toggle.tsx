import { Moon, Sun, SunMoon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownIconStart,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme, ThemeProvider } from "@/components/theme-provider"
import React from "react";
import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";

export function ModeToggleInner() {
  const { setTheme } = useTheme();
  const currentTheme = localStorage.getItem("vite-ui-theme");
  return (<>
    <DropdownMenuCheckboxItem checked={currentTheme == "light"} onCheckedChange={() => setTheme("light")} onSelect={e => e.preventDefault()}>
      <DropdownIconStart icon={<Sun />} />
      Light
    </DropdownMenuCheckboxItem>
    <DropdownMenuCheckboxItem checked={currentTheme == "dark"} onCheckedChange={() => setTheme("dark")} onSelect={e => e.preventDefault()}>
      <DropdownIconStart icon={<Moon />} />
      Dark
    </DropdownMenuCheckboxItem>
    <DropdownMenuCheckboxItem checked={currentTheme == "system"} onCheckedChange={() => setTheme("system")} onSelect={e => e.preventDefault()}>
      <DropdownIconStart icon={<SunMoon />} />
      System
    </DropdownMenuCheckboxItem>
  </>
  )
}

export function ModeToggle() {

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="circular" size="icon">
          <Sun className="h-[1.2rem] z-0 w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute z-0 h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {React.Children.toArray(<ModeToggleInner />)}
      </DropdownMenuContent>
    </DropdownMenu >
  )
}
