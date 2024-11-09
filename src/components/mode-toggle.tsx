import { Moon, Sun, SunMoon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownIconStart,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/components/theme-provider"
import React from "react";

export function ModeToggleInner() {
  const { setTheme } = useTheme();
  return (<>
    <DropdownMenuItem onClick={() => setTheme("light")}>
    <DropdownIconStart icon={<Sun />} />
      Light
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setTheme("dark")}>
    <DropdownIconStart icon={<Moon />} />
      Dark
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setTheme("system")}>
    <DropdownIconStart icon={<SunMoon />} />
      System
    </DropdownMenuItem>
  </>
  )
}

export function ModeToggle() {

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="circular" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
      {React.Children.toArray(<ModeToggleInner />)}
      </DropdownMenuContent>
    </DropdownMenu >
  )
}
