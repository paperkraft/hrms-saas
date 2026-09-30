"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(
          "flex items-center justify-center size-8 rounded-md text-muted-foreground bg-transparent transition-colors opacity-50",
          className
        )}
        aria-label="Theme toggle placeholder"
        disabled
      >
        <Sun className="size-4" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark" || theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className={cn(
        "flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer",
        showLabel && "w-auto px-2.5 gap-2",
        className
      )}
    >
      {isDark ? (
        <Sun className="size-4 text-amber-500 animate-in spin-in-90 duration-200" />
      ) : (
        <Moon className="size-4 text-muted-foreground animate-in spin-in-90 duration-200" />
      )}
      {showLabel && (
        <span className="text-xs font-medium text-foreground">
          {isDark ? "Light" : "Dark"}
        </span>
      )}
    </button>
  );
}
