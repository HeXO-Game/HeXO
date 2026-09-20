import type { FinishedGameSummary } from '@ih3t/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buildFinishedGamePath } from '../routes/archiveRouteState';
import { cn } from '../utils/cn';
import { formatDateTime, useIntlFormatProvider } from '../utils/dateTime';
import { formatCompactDuration } from '../utils/duration';
import { formatEloChange } from '../utils/elo';
import BotBadge from './BotBadge';
import {
    type PersonalResultTone,
    getNeutralResultLabel,
    getPersonalResultLabel,
} from '../utils/finishedGames';
import { getPlayerColor } from '../utils/gameBoard';

function getResultPresentation(
    game: FinishedGameSummary,
    isOwnArchive: boolean,
    currentProfileId: string | null,
): {
    label: string
    tone: PersonalResultTone
    cardClassName: string
    titleClassName: string
} {
    const result = isOwnArchive
        ? getPersonalResultLabel(game, currentProfileId)
        : { label: getNeutralResultLabel(game), tone: `neutral` as const };
    const sharedCardClassName = `border-white/10 bg-white/6 hover:border-sky-300/30 hover:bg-white/10`;

    if (result.tone === `win`) {
        return {
            ...result,
            cardClassName: `${sharedCardClassName} pl-6 shadow-[inset_3px_0_0_rgba(16,185,129,1),inset_22px_0_28px_-24px_rgba(16,185,129,0.95)]`,
            titleClassName: `text-white`,
        };
    } else if (result.tone === `loss`) {
        return {
            ...result,
            cardClassName: `${sharedCardClassName} pl-6 shadow-[inset_3px_0_0_rgba(244,63,94,1),inset_22px_0_28px_-24px_rgba(244,63,94,0.95)]`,
            titleClassName: `text-white`,
        };
    }

    return {
        ...result,
        cardClassName: `${sharedCardClassName} ${isOwnArchive ? `pl-6` : ``}`,
        titleClassName: `text-white`,
    };
}

type FinishedGameCardProps = {
    game: FinishedGameSummary
    context: `history` | `user-history` | `user-profile`
    currentProfileId: string | null
};

function FinishedGameCard({
    game,
    context,
    currentProfileId,
}: Readonly<FinishedGameCardProps>) {
    const isOwnArchive = context !== `history`;
    const to = buildFinishedGamePath(game.id, context === `user-history` ? `mine` : `all`);
    const { t } = useTranslation();
    const intlFormatProvider = useIntlFormatProvider();
    const presentation = getResultPresentation(game, isOwnArchive, currentProfileId);

    const profilePlayer = isOwnArchive ? game.players.find(player => player.profileId === currentProfileId) : null;
    const eloChange = game.gameOptions.rated ? profilePlayer?.eloChange ?? null : null;

    return (
        <Link to={to} className={cn(`block w-full rounded-lg border cursor-pointer px-4 py-3.5 text-left transition sm:px-4.5 sm:py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300`, presentation.cardClassName)}>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex flex-col">
                    <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-300 sm:text-xs">
                        <span className={`rounded-full px-2.5 py-0.5 ${game.gameOptions.rated
                            ? `bg-amber-300/15 text-amber-100`
                            : `bg-slate-900/60 text-slate-200`}`}
                        >
                            {game.gameOptions.rated ? t('rated', 'Rated') : t('unrated', 'Unrated')}
                        </span>

                        {eloChange !== null && (
                            <span className={`rounded-full px-2.5 py-0.5 ${eloChange >= 0
                                ? `bg-emerald-400/12 text-emerald-200`
                                : `bg-rose-400/12 text-rose-200`}`}
                            >
                                {t('eloChange', 'ELO {{change}}', { change: formatEloChange(eloChange) })}
                            </span>
                        )}

                        <span className="rounded-full bg-slate-900/60 px-2.5 py-0.5">
                            {t('moveCount', 'Moves: {{count}}', { count: game.moveCount })}
                        </span>

                        <span className="rounded-full bg-slate-900/60 px-2.5 py-0.5">
                            {t('gameDuration', 'Duration: {{duration}}', { duration: formatCompactDuration(game.gameResult?.durationMs ?? 0) })}
                        </span>
                    </div>

                    <span className="mt-2 flex flex-wrap items-center gap-y-2 text-base">
                        {game.players.flatMap((player, index) => [
                            index > 0 && (
                                <span className="mx-3" key={`vs-${index}`}>
                                    vs
                                </span>
                            ),
                            <span
                                key={player.playerId}
                                className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5 bg-background/20 px-2 rounded-md", !isOwnArchive && player.playerId === game.gameResult?.winningPlayerId && "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/30")}
                            >
                                <span
                                    className="size-4 shrink-0 rounded-full"
                                    style={{ backgroundColor: getPlayerColor(game.playerTiles, player.playerId) }}
                                />

                                <span className="break-all">
                                    {player.displayName}
                                </span>

                                {player.isBot === true && <BotBadge />}
                            </span>,
                        ])}
                    </span>

                    <div className={cn(`mt-2 text-base font-bold`, presentation.titleClassName)}>
                        {presentation.label}
                    </div>
                </div>

                <div className="text-[11px] text-slate-300 sm:text-right sm:text-xs">
                    <div className="font-semibold text-white">
                        {formatDateTime(intlFormatProvider, game.finishedAt ?? game.startedAt)}
                    </div>
                </div>
            </div>
        </Link>
    );
}

export default FinishedGameCard;
