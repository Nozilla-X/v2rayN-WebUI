import { createI18n } from 'vue-i18n'
import zhCN from './Locales/zh-CN.json'
import zhTW from './Locales/zh-TW.json'
import enUS from './Locales/en-US.json'

const savedLocale = localStorage.getItem('v2rayn-web-locale')
const availableLocales = ['zh-CN', 'zh-TW', 'en-US'] as const

function detectBrowserLocale(): (typeof availableLocales)[number] {
  const candidates = typeof navigator === 'undefined'
    ? []
    : navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const language of candidates) {
    const normalized = language.replaceAll('_', '-').toLowerCase()
    if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk') || normalized.startsWith('zh-mo') || normalized.startsWith('zh-hant')) {
      return 'zh-TW'
    }
    if (normalized.startsWith('zh')) return 'zh-CN'
    if (normalized.startsWith('en')) return 'en-US'
  }
  return 'en-US'
}

const initialLocale = availableLocales.includes(savedLocale as (typeof availableLocales)[number])
  ? savedLocale as (typeof availableLocales)[number]
  : detectBrowserLocale()

if (typeof document !== 'undefined') document.documentElement.lang = initialLocale

export default createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'zh-CN',
  messages: { 'zh-CN': zhCN, 'zh-TW': zhTW, 'en-US': enUS },
})
