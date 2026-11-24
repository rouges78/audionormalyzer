"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

/**
 * Soft UI style light/dark switch.
 * The active segment is "sunken" (nu-in), the inactive one is flush:
 * it is the same grammar used by tabs and slider.
 */
export function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // next-themes only knows the theme after hydration: before that
  // any rendered icon would be the wrong one half of the time.
  React.useEffect(() => setMounted(true), [])

  const current = theme === "system" ? systemTheme : theme
  const isDark = current === "dark"

  if (!mounted) {
    return <div className="h-10 w-[104px] rounded-full nu-in" aria-hidden="true" />
  }

  return (
    <div
      className="inline-flex rounded-full p-1.5 nu-in"
      role="group"
      aria-label="Tema dell'interfaccia"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={!isDark}
        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
          !isDark ? "nu-sm text-[color:var(--primary-ink)] bg-background" : "text-muted-foreground"
        }`}
      >
        <Sun className="h-3.5 w-3.5" aria-hidden="true" />
        Chiaro
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={isDark}
        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
          isDark ? "nu-sm text-[color:var(--primary-ink)] bg-background" : "text-muted-foreground"
        }`}
      >
        <Moon className="h-3.5 w-3.5" aria-hidden="true" />
        Scuro
      </button>
    </div>
  )
}
