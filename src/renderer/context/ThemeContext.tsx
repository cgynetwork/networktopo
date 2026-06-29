import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export type ThemeName = 'default' | 'gilded'

interface ThemeContextValue {
  theme: ThemeName
  toggleTheme: () => void
  setTheme: (theme: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'default',
  toggleTheme: () => {},
  setTheme: () => {},
})

const STORAGE_KEY = 'topo-theme'

function getStoredTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'gilded') return 'gilded'
  } catch { /* localStorage unavailable */ }
  return 'default'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(getStoredTheme)

  // Apply data-theme attribute to <html> whenever theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch { /* ignore */ }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'default' ? 'gilded' : 'default'))
  }, [])

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
