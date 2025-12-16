import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslations from './en/translation.json';
import arTranslations from './ar/translation.json';

// Language detection options
const detectionOptions = {
  // Order of detection methods
  order: ['localStorage', 'navigator'],
  
  // Keys to lookup language from
  lookupLocalStorage: 'i18nextLng',
  
  // Cache user language
  caches: ['localStorage'],
  
  // Only check these languages
  checkWhitelist: true,
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
      ar: {
        translation: arTranslations,
      },
    },
    fallbackLng: 'en',
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: detectionOptions,
    // Enable debug in development
    debug: import.meta.env.DEV,
  });

// Update HTML dir attribute when language changes
i18n.on('languageChanged', (lng) => {
  const html = document.documentElement;
  html.setAttribute('lang', lng);
  html.setAttribute('dir', lng === 'ar' ? 'rtl' : 'ltr');
  
  // Also update body if needed
  document.body.setAttribute('dir', lng === 'ar' ? 'rtl' : 'ltr');
});

// Set initial direction
const currentLang = i18n.language || 'en';
const html = document.documentElement;
html.setAttribute('lang', currentLang);
html.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');
document.body.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');

export default i18n;


