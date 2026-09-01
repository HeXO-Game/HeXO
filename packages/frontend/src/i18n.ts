import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de/translation.json';
import en from './locales/en/translation.json';

void i18next.use(initReactI18next).init({
    fallbackLng: `en`,
    interpolation: { escapeValue: false },
    lng: `en`,
    supportedLngs: [`en`, `de`],
    resources: {
        de: { translation: de },
        en: { translation: en },
    },
});

export default i18next;
