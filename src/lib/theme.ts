export const THEME_KEY = "cipher-theme"

export interface StoredTheme {
  id: string
  hue: number
  mode: "dark" | "light"
}

export const PRESETS = [
  { id: "default", label: "Default", hue: 222 },
  { id: "crimson", label: "Crimson", hue: 0   },
  { id: "ocean",   label: "Ocean",   hue: 195  },
  { id: "forest",  label: "Forest",  hue: 142  },
  { id: "violet",  label: "Violet",  hue: 270  },
  { id: "ember",   label: "Ember",   hue: 25   },
  { id: "rose",    label: "Rose",    hue: 330  },
] as const

// Only tints the surface/background colors — foreground & destructive untouched
function darkVars(hue: number): Record<string, string> {
  return {
    "--background":       `${hue} 84% 4.9%`,
    "--card":             `${hue} 84% 4.9%`,
    "--popover":          `${hue} 84% 4.9%`,
    "--secondary":        `${hue} 32.6% 17.5%`,
    "--muted":            `${hue} 32.6% 17.5%`,
    "--accent":           `${hue} 32.6% 17.5%`,
    "--border":           `${hue} 32.6% 17.5%`,
    "--input":            `${hue} 32.6% 17.5%`,
    "--ring":             `${hue} 26.8% 83.9%`,
    "--muted-foreground": `${hue} 20.2% 65.1%`,
  }
}

function lightVars(hue: number): Record<string, string> {
  return {
    "--background":       `${hue} 30% 99%`,
    "--card":             `${hue} 30% 99%`,
    "--popover":          `${hue} 30% 99%`,
    "--primary":          `${hue} 47.4% 11.2%`,
    "--secondary":        `${hue} 40% 96%`,
    "--muted":            `${hue} 40% 96%`,
    "--accent":           `${hue} 40% 96%`,
    "--border":           `${hue} 30% 91%`,
    "--input":            `${hue} 30% 91%`,
    "--ring":             `${hue} 84% 4.9%`,
    "--muted-foreground": `${hue} 16.3% 46.9%`,
    "--foreground":       `${hue} 84% 4.9%`,
    "--card-foreground":  `${hue} 84% 4.9%`,
    "--popover-foreground": `${hue} 84% 4.9%`,
    "--accent-foreground": `${hue} 47.4% 11.2%`,
    "--secondary-foreground": `${hue} 47.4% 11.2%`,
    "--primary-foreground": `210 40% 98%`,
  }
}

const ALL_VAR_KEYS = [
  "--background", "--card", "--popover", "--primary", "--primary-foreground",
  "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
  "--accent", "--accent-foreground", "--border", "--input", "--ring",
  "--foreground", "--card-foreground", "--popover-foreground",
]

export function applyTheme(theme: StoredTheme) {
  const root = document.documentElement

  // Toggle dark class
  if (theme.mode === "light") {
    root.classList.remove("dark")
  } else {
    root.classList.add("dark")
  }

  // Clear all inline overrides first so we don't bleed stale vars
  for (const k of ALL_VAR_KEYS) root.style.removeProperty(k)

  // For "default" preset, rely entirely on the CSS class — no overrides needed
  if (theme.id === "default") return

  const vars = theme.mode === "light" ? lightVars(theme.hue) : darkVars(theme.hue)
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
}

export function getStoredTheme(): StoredTheme | null {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    return raw ? (JSON.parse(raw) as StoredTheme) : null
  } catch {
    return null
  }
}

export function saveTheme(theme: StoredTheme) {
  localStorage.setItem(THEME_KEY, JSON.stringify(theme))
  applyTheme(theme)
  window.dispatchEvent(new Event("cipher-theme-changed"))
}

// Canvas-based dominant hue extraction.
// Samples the image, skips near-black/near-white/near-grey pixels,
// weights remaining pixels by saturation, returns the dominant hue in degrees.
export function extractDominantHue(img: HTMLImageElement): number {
  const SIZE = 100
  const canvas = document.createElement("canvas")
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext("2d")
  if (!ctx) return 222
  ctx.drawImage(img, 0, 0, SIZE, SIZE)
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE)

  // 36 bins × 10° each
  const bins = new Float32Array(36)

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    const d = max - min
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))

    if (l < 0.12 || l > 0.88 || s < 0.15) continue

    let h = 0
    if (d > 0) {
      if (max === r) h = ((g - b) / d) % 6
      else if (max === g) h = (b - r) / d + 2
      else h = (r - g) / d + 4
      h = h / 6
      if (h < 0) h += 1
    }

    bins[Math.floor(h * 36) % 36] += s
  }

  let maxBin = 0
  for (let i = 1; i < 36; i++) if (bins[i] > bins[maxBin]) maxBin = i

  if (bins[maxBin] === 0) return 222
  return Math.round(maxBin * 10 + 5) % 360
}
