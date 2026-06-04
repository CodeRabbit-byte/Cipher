"use client"

import { useEffect } from "react"
import { getStoredTheme, applyTheme } from "@/lib/theme"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function apply() {
      const theme = getStoredTheme()
      if (theme) applyTheme(theme)
    }
    apply()
    window.addEventListener("cipher-theme-changed", apply)
    return () => window.removeEventListener("cipher-theme-changed", apply)
  }, [])

  return <>{children}</>
}
