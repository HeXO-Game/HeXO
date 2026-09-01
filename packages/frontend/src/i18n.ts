import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de/translation.json';
import en from './locales/en/translation.json';
import koKR from './locales/ko-kr/translation.json';
import zhCN from './locales/zh-cn/translation.json';

void i18next.use(initReactI18next).init({
    fallbackLng: `en`,
    interpolation: { escapeValue: false },
    lng: `en`,
    returnEmptyString: false,
    supportedLngs: [`en`, `de`, `ko-KR`, `zh-CN`],
    resources: {
        de: { translation: de },
        en: { translation: en },
        'ko-KR': { translation: koKR },
        'zh-CN': { translation: zhCN },
    },
});

export default i18next;
