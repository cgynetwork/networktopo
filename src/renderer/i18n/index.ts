import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import zh from './resources/zh.json'
import en from './resources/en.json'

const STORAGE_KEY = 'topo-lang'

function getStoredLanguage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'zh') return stored
  } catch { /* localStorage unavailable */ }
  return 'zh'
}

i18next.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'zh',
  interpolation: {
    escapeValue: false, // React already escapes
  },
  returnNull: false,
})

export function getT() {
  return i18next.t.bind(i18next)
}

export const t = i18next.t.bind(i18next)

export function persistLanguage(lang: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch { /* ignore */ }
}

export default i18next
