import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh.json';
import en from './locales/en.json';

const LANG_KEY = 'nerve-hub-lang';

export function getStoredLang(): string {
  try {
    return localStorage.getItem(LANG_KEY) || 'zh';
  } catch {
    return 'zh';
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: getStoredLang(),
  fallbackLng: 'zh',
  interpolation: { escapeValue: false },
});

document.documentElement.lang = i18n.language.startsWith('zh') ? 'zh-CN' : 'en';
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng.startsWith('zh') ? 'zh-CN' : 'en';
});

export function setAppLanguage(lng: string) {
  try {
    localStorage.setItem(LANG_KEY, lng);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lng === 'zh' ? 'zh-CN' : 'en';
  return i18n.changeLanguage(lng);
}

export default i18n;
