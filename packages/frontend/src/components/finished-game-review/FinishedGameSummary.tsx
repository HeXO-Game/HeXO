import type { BoardTheme } from '@ih3t/board-renderer';
import type { FinishedGameRecord } from '@ih3t/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { formatDateTimeWithSeconds, useIntlFormatProvider } from '../../utils/dateTime';
import { formatMinutesSeconds } from '../../utils/duration';
import { formatEloChange } from '../../utils/elo';
import { getPlayerLabel, getPlayerColor } from '../../utils/gameBoard';
import { formatTimeControl } from '../../utils/gameTimeControl';
import { getSessionFinishReasonSentenceLabel } from '../../utils/sessionResult';

function getProfileHref(profileId: string | null | undefined): string | null {
    const normalizedProfileId = profileId?.trim();
    return normalizedProfileId ? `/profile/${encodeURIComponent(normalizedProfileId)}` : null;
}

type FinishedGameSummaryProps = {
    game: FinishedGameRecord
    theme: BoardTheme
};

function FinishedGameSummary({ game, theme }: Readonly<FinishedGameSummaryProps>) {
    const { t } = useTranslation();
    const intlFormatProvider = useIntlFormatProvider();
    const gameResult = game.gameResult ?? null;
    const isDraw = gameResult?.reason === `draw-agreement`;

    return (
        <section className="flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-[0_20px_80px_rgba(15,23,42,0.45)] backdrop-blur sm:rounded-4xl sm:p-5">
            <div className={`text-sm uppercase tracking-[0.3em] text-slate-300 `}>
                {t('matchSummary', 'Match Summary')}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        {t('finished', 'Finished')}
                    </div>

                    <div className="mt-1 text-sm text-white">
                        {formatDateTimeWithSeconds(intlFormatProvider, game.finishedAt ?? game.startedAt)}
                    </div>

                    <div className="mt-1 text-sm text-white">
                        {`Duration `}
                        {formatMinutesSeconds(gameResult?.durationMs ?? 0)}
                    </div>
                </div>

                <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        {t('gameType', 'Game Type')}
                    </div>

                    <div className="mt-1 text-sm text-white">
                        {game.gameOptions.rated ? `Rated` : `Casual`}
                    </div>
                </div>

                <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        {t('timeControl', 'Time Control')}
                    </div>

                    <div className="mt-1 text-sm text-white">
                        {formatTimeControl(game.gameOptions.timeControl)}
                    </div>
                </div>

                <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        {t('finishReason', 'Finish Reason')}
                    </div>

                    <div className="mt-1 text-sm text-white">
                        {getSessionFinishReasonSentenceLabel(gameResult?.reason)}
                    </div>
                </div>

                <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        {t('players', 'Players')}
                    </div>

                    <div className="mt-1.5 space-y-0.5">
                        {game.players.map((player) => {
                            const playerProfileHref = getProfileHref(player.profileId);

                            return (
                                <div
                                    key={player.playerId}
                                    className="flex flex-col items-start gap-2 py-1 text-sm text-white sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                        <span
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{ backgroundColor: getPlayerColor(game.playerTiles, player.playerId, theme) }}
                                        />

                                        {playerProfileHref
                                            ? (
                                                <Link
                                                    to={playerProfileHref}
                                                    className="wrap-break-word transition hover:text-sky-100"
                                                >
                                                    {getPlayerLabel(game.players, player.playerId)}
                                                </Link>
                                            )
                                            : (
                                                <span className="wrap-break-word">
                                                    {getPlayerLabel(game.players, player.playerId)}
                                                </span>
                                            )}

                                        {gameResult?.winningPlayerId === player.playerId && (
                                            <span className="rounded-full border border-amber-200/30 bg-amber-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-black">
                                                {t('winner', 'Winner')}
                                            </span>
                                        )}

                                        {isDraw && (
                                            <span className="rounded-full border border-sky-200/30 bg-sky-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-950">
                                                {t('draw', 'Draw')}
                                            </span>
                                        )}
                                    </div>

                                    <div className="w-full text-left sm:w-auto sm:text-right">
                                        {player.elo !== null && (
                                            <div className="text-sm font-medium text-white">
                                                {t('eloRatingValue', '{{elo}} ELO', { elo: player.elo })}
                                            </div>
                                        )}

                                        {player.eloChange !== null && (
                                            <div className={`text-xs ${player.eloChange >= 0 ? `text-emerald-300` : `text-rose-300`}`}>
                                                {formatEloChange(player.eloChange)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default FinishedGameSummary;
