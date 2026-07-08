import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import i18next, { persistLanguage } from '../i18n'

export type Language = 'zh' | 'en'

interface LanguageContextValue {
  language: Language
  toggleLanguage: () => void
  setLanguage: (lang: Language) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'zh',
  toggleLanguage: () => {},
  setLanguage: () => {},
})

function getStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem('topo-lang')
    if (stored === 'en') return 'en'
  } catch { /* localStorage unavailable */ }
  return 'zh'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getStoredLanguage)
  const { i18n } = useTranslation()

  useEffect(() => {
    i18n.changeLanguage(language)
    persistLanguage(language)
    // Notify main process to rebuild native menu
    try {
      window.electronAPI?.setLanguage?.(language)
    } catch { /* electronAPI not available (e.g. in browser dev) */ }
  }, [language, i18n])

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === 'zh' ? 'en' : 'zh'))
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
  }, [])

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext)
}
