import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import translation from './locales/en/translation.json';

void i18next.use(initReactI18next).init({
    fallbackLng: `en`,
    interpolation: { escapeValue: false },
    lng: `en`,
    resources: { en: { translation } },
});

export default i18next;
