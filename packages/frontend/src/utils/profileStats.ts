import i18next from 'i18next'
export function formatWorldRank(worldRank: number | null) {
    return worldRank === null ? `--` : i18next.t('worldrank', '#{{worldRank}}', { worldRank });
}

export function formatWinSummary(won: number, played: number) {
    if (played <= 0) {
        return i18next.t('noFinishedGamesYet', 'No finished games yet.');
    }

    const winRate = Math.round((won / played) * 100);
    return i18next.t('wonWonWinrateWinRate', '{{won}} won · {{winRate}}% win rate', { won, winRate });
}

export function formatStreakDetail(streak: number) {
    return i18next.t('countConsecutiveRatedWins', { defaultValue_one: '1 consecutive rated win.', defaultValue_other: '{{count}} consecutive rated wins.', count: streak });
}
