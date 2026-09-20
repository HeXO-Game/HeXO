import { useTranslation } from 'react-i18next'

/** Marks a bot seat wherever a player is named: lobby list, HUD, history, profile. */
export default function BotBadge() {
    const { t } = useTranslation()

    return (
        <span
            className="inline-flex shrink-0 items-center rounded-full border border-sky-300/30 bg-sky-400/15 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.14em] text-sky-200"
            title={t('botAccount', 'Bot')}
        >
            {t('bot', 'Bot')}
        </span>
    )
}
