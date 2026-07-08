import i18next from 'i18next'
import { readFileSync } from 'fs'
import { join } from 'path'

// In main process, we load the JSON files directly from disk
// because we cannot use static imports from outside the src/main directory
function loadResources() {
  try {
    // In production, resources are copied alongside the main output
    const basePath = join(__dirname, '..', 'renderer', 'i18n', 'resources')
    const zh = JSON.parse(readFileSync(join(basePath, 'zh.json'), 'utf-8'))
    const en = JSON.parse(readFileSync(join(basePath, 'en.json'), 'utf-8'))
    return { zh, en }
  } catch {
    // Fallback: try relative to project root (dev mode)
    try {
      const basePath = join(__dirname, '..', '..', 'src', 'renderer', 'i18n', 'resources')
      const zh = JSON.parse(readFileSync(join(basePath, 'zh.json'), 'utf-8'))
      const en = JSON.parse(readFileSync(join(basePath, 'en.json'), 'utf-8'))
      return { zh, en }
    } catch {
      // Last resort: inline minimal resources
      return {
        zh: {},
        en: {},
      }
    }
  }
}

const resources = loadResources()

i18next.init({
  resources: {
    zh: { translation: resources.zh },
    en: { translation: resources.en },
  },
  lng: 'zh',
  fallbackLng: 'zh',
  interpolation: {
    escapeValue: false,
  },
})

export default i18next
