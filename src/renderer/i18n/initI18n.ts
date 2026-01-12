import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import zhTranslation from './locales/zh.json'
import enTranslation from './locales/en.json'

// 语言资源
const resources = {
  zh: {
    translation: zhTranslation
  },
  en: {
    translation: enTranslation
  }
}

// 配置i18next
const i18nConfig = {
  resources, // 使用静态导入的资源
  fallbackLng: 'zh',
  debug: process.env.NODE_ENV === 'development',
  interpolation: {
    escapeValue: false // not needed for react as it escapes by default
  },
  detection: {
    order: ['localStorage', 'navigator'], // 优先使用localStorage中的语言设置
    caches: ['localStorage'] // 将语言设置缓存到localStorage
  }
}

// 初始化i18next
export const initI18n = async (): Promise<typeof i18n> => {
  await i18n.use(LanguageDetector).use(initReactI18next).init(i18nConfig)
  return i18n
}
