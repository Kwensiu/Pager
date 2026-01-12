import { useTranslation } from 'react-i18next'
import type { TFunction, i18n } from 'i18next'

export const useI18n = (): {
  t: TFunction<'translation', undefined>
  changeLanguage: (lng: string) => Promise<void>
  getCurrentLanguage: () => string
  currentLang: string
  i18n: i18n
} => {
  const { t, i18n } = useTranslation()

  const changeLanguage = async (lng: string): Promise<void> => {
    await i18n.changeLanguage(lng)
  }

  const getCurrentLanguage = (): string => {
    return i18n.language
  }

  return {
    t,
    changeLanguage,
    getCurrentLanguage,
    currentLang: i18n.language,
    i18n
  }
}
