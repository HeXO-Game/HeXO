import i18next from 'i18next'
export function formatEloChange(eloChange: number) {
    return i18next.t('valelochange', '{{val}}{{eloChange}}', { val: eloChange >= 0 ? `+` : ``, eloChange });
}
