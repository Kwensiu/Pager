import React from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18nConfig'

interface I18nContextProps {
  children: React.ReactNode
}

export const I18nProviderWrapper: React.FC<I18nContextProps> = ({ children }) => {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
