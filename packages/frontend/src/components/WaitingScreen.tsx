import { Button } from '@/components/ui/button';
import type { LobbyOptions, MatchClaimWinState, SessionTournamentInfo } from '@ih3t/shared';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

import { useLiveGameStore } from '../liveGameStore';
import { claimMatchWin, requestMatchExtension } from '../query/tournamentClient';
import { formatTimeControl } from '../utils/gameTimeControl';
import ScreenFooter from './ScreenFooter';
import { useTranslation } from 'react-i18next'

type WaitingScreenProps = {
    sessionId: string
    playerCount: number
    localPlayerName: string,
    localProfileId: string | null,
    gameOptions: LobbyOptions
    tournament: SessionTournamentInfo | null
    onInviteFriend: () => void
    onPlayOffline?: () => void
    onCancel: () => void
};

function useCountdown(targetMs: number | null): number | null {
    const [remaining, setRemaining] = useState<number | null>(() => {
        if (targetMs === null) return null;
        return Math.max(0, targetMs - Date.now());
    });

    useEffect(() => {
        if (targetMs === null) {
            setRemaining(null);
            return;
        }

        const tick = () => {
            const r = Math.max(0, targetMs - Date.now());
            setRemaining(r);
        };

        tick();
        const interval = setInterval(tick, 250);
        return () => clearInterval(interval);
    }, [targetMs]);

    return remaining;
}

function formatCountdown(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, `0`)}`;
}

function TournamentTimerSection({
    tournament,
    claimWinState,
    opponentName,
}: {
    tournament: SessionTournamentInfo
    claimWinState: MatchClaimWinState | null
    opponentName: string | null
}) {
    const { t } = useTranslation()
    const hasTimeout = tournament.matchJoinTimeoutMs > 0;
    const joinDeadline = useMemo(
        () => tournament.matchJoinTimeoutInMs !== null ? Date.now() + tournament.matchJoinTimeoutInMs : null,
        [tournament.matchJoinTimeoutInMs],
    );
    const claimDeadline = useMemo(
        () => claimWinState !== null ? Date.now() + claimWinState.expiresInMs : null,
        [claimWinState],
    );
    const joinRemaining = useCountdown(joinDeadline);
    const claimRemaining = useCountdown(claimDeadline);
    const [isClaimPending, setIsClaimPending] = useState(false);
    const [isExtensionPending, setIsExtensionPending] = useState(false);
    const extensionMinutes = Math.round(tournament.matchExtensionMs / 60_000);

    const isTimedOut = hasTimeout && joinRemaining !== null && joinRemaining <= 0;
    const hasActiveClaim = claimWinState !== null;
    const hasPendingExtension = tournament.pendingExtension;

    if (!hasTimeout) {
        return null;
    }

    const handleClaimWin = async () => {
        try {
            setIsClaimPending(true);
            await claimMatchWin(tournament.tournamentId, tournament.matchId);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : t('failedToClaimWin', 'Failed to claim win.');
            toast.error(message, { toastId: `claim-win-error` });
        } finally {
            setIsClaimPending(false);
        }
    };

    const handleRequestExtension = async () => {
        try {
            setIsExtensionPending(true);
            await requestMatchExtension(tournament.tournamentId, tournament.matchId);
            toast.success(t('extensionRequestedWaitingForOrganizerApproval', 'Extension requested. Waiting for organizer approval.'), { toastId: `extension-requested` });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : t('failedToRequestExtension', 'Failed to request extension.');
            toast.error(message, { toastId: `extension-error` });
        } finally {
            setIsExtensionPending(false);
        }
    };

    if (hasActiveClaim && claimRemaining !== null) {
        const claimSeconds = Math.ceil(claimRemaining / 1000);
        return (
            <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-4 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-200/80">
                    {t('claimingWin', 'Claiming Win')}
                </div>
                <div className="mt-2 text-3xl font-black tabular-nums text-rose-100">{t('claimsecondss', '{{claimSeconds}}s', { claimSeconds })}</div>
                <p className="mt-1 text-xs text-rose-200/70">
                    {opponentName ?? `Opponent`}{t('hasClaimsecondsSecond', 'has {{claimSeconds}} second', { claimSeconds })}{claimSeconds !== 1 ? `s` : ``} {t('toJoinBeforeTheMatchIsForfeited', 'to join before the match is forfeited.')}
                </p>
            </div>
        );
    }

    if (hasPendingExtension) {
        return (
            <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-4 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
                    {t('extensionPending', 'Extension Pending')}
                </div>
                <p className="mt-2 text-sm text-amber-100/80">
                    {isTimedOut
                        ? t('theJoinTimerExpiredAndAnExtensionRequestIsWaitingForOrganizerReview', 'The join timer expired, and an extension request is waiting for organizer review.')
                        : t('anExtensionRequestIsWaitingForOrganizerReview', 'An extension request is waiting for organizer review.')}
                </p>
            </div>
        );
    }

    if (isTimedOut) {
        return (
            <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-4 text-center">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
                        {t('joinTimerExpired', 'Join Timer Expired')}
                    </div>
                    <p className="mt-2 text-sm text-amber-100/80">
                        {opponentName ?? t('yourOpponent', 'Your opponent')} {t('didNotJoinInTime', 'did not join in time.')}
                    </p>
                </div>

                <Button
                    type="button"
                    onClick={() => void handleClaimWin()}
                    disabled={isClaimPending}
                    variant="success" size="lg" className="w-full"
                >
                    {isClaimPending ? `Claiming...` : `Claim Win`}
                </Button>

                <Button
                    type="button"
                    onClick={() => void handleRequestExtension()}
                    disabled={isExtensionPending}
                    variant="outline" size="lg" className="w-full"
                >
                    {isExtensionPending ? `Requesting...` : t('requestExtensionExtensionminutesMin', 'Request Extension (+{{extensionMinutes}} min)', { extensionMinutes })}
                </Button>
            </div>
        );
    }

    return (
        <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                    {opponentName ? t('opponentnameMustJoinWithin', '{{opponentName}} Must Join Within', { opponentName }) : t('opponentMustJoinWithin', 'Opponent Must Join Within')}
                </div>
                <div className="mt-2 text-3xl font-black tabular-nums text-white">
                    {joinRemaining !== null ? formatCountdown(joinRemaining) : `--:--`}
                </div>
            </div>

            <Button
                type="button"
                onClick={() => void handleRequestExtension()}
                disabled={isExtensionPending}
                variant="outline" size="lg" className="w-full"
            >
                {isExtensionPending ? `Requesting...` : `Request Extension`}
            </Button>
        </div>
    );
}

function WaitingScreen({
    sessionId,
    playerCount,
    localPlayerName,
    localProfileId,
    gameOptions,
    tournament,
    onInviteFriend,
    onPlayOffline,
    onCancel,
}: Readonly<WaitingScreenProps>) {
    const { t } = useTranslation()
    const isTournament = tournament !== null;
    const claimWinState = useLiveGameStore((s) => s.claimWinState);
    const opponentName = isTournament
        ? (localProfileId === tournament.leftProfileId ? tournament.rightDisplayName : tournament.leftDisplayName)
        : null;
    const showOfflinePlayButton = !isTournament && gameOptions.visibility === `public` && playerCount < 2 && Boolean(onPlayOffline);

    return (
        <div className="flex flex-col justify-between h-full p-4 mx-8">
            <div className="flex flex-col min-w-30 w-full max-w-2xl self-center my-auto pb-[10svh]">
                <h2 className="font-black uppercase tracking-[0.08em] text-white mt-6 text-4xl">
                    {t('waitingForVal', 'Waiting for {{val}}', { val: isTournament ? opponentName ?? `opponent` : `another player` })}
                </h2>

                <p className="mt-4 text-slate-200 text-base leading-7">
                    {isTournament
                        ? t('yourOpponentHasBeenNotifiedTheMatchWillStartAutomaticallyOnceTheyJoin', 'Your opponent has been notified. The match will start automatically once they join.')
                        : gameOptions.visibility === `private`
                            ? t('keepThisSessionOpenAndShareTheInviteLinkWithThePlayerYouWantToJoinTheMatchWillLaunchAutomaticallyOnceTheyArrive', 'Keep this session open and share the invite link with the player you want to join. The match will launch automatically once they arrive.')
                            : t('keepThisSessionOpenAsSoonAsTheSecondPlayerJoinsTheMatchWillLaunchAutomatically', 'Keep this session open. As soon as the second player joins, the match will launch automatically.')}
                </p>

                <div className="relative flex flex-1 flex-col justify-center">
                    <div className="mt-6 grid gap-3 sm:mt-8 sm:gap-4 sm:grid-cols-2">
                        {isTournament ? (
                            <>
                                <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4 sm:rounded-3xl sm:p-5">
                                    <div className="text-xs uppercase tracking-[0.28em] text-slate-300">
                                        {t('tournament', 'Tournament')}
                                    </div>
                                    <div className="mt-2 break-words text-lg font-bold leading-tight text-white">
                                        {tournament.tournamentName}
                                    </div>
                                </div>
                                <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4 sm:rounded-3xl sm:p-5">
                                    <div className="text-xs uppercase tracking-[0.28em] text-slate-300">
                                        {t('timeControl', 'Time Control')}
                                    </div>
                                    <div className="mt-2 break-words text-xl font-bold leading-tight text-white sm:text-2xl">
                                        {formatTimeControl(gameOptions.timeControl)}
                                    </div>
                                    <div className="mt-1 whitespace-nowrap text-sm tabular-nums text-slate-400">
                                        {tournament.bracket.replace(/-/g, ` `)}{t('rroundBobestofGameCurrentgamenumberScoreLeftwinsrightwins', 'R{{round}} · BO{{bestOf}} · Game {{currentGameNumber}} · Score {{leftWins}}‑{{rightWins}}', { round: tournament.round, bestOf: tournament.bestOf, currentGameNumber: tournament.currentGameNumber, leftWins: tournament.leftWins, rightWins: tournament.rightWins })}</div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4 sm:rounded-3xl sm:p-5">
                                    <div className="text-xs uppercase tracking-[0.28em] text-slate-300">
                                        {t('sessionId', 'Session ID')}
                                    </div>
                                    <div className="mt-2 break-all text-2xl font-bold text-amber-200 sm:text-3xl">
                                        {sessionId}
                                    </div>
                                </div>
                                <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4 sm:rounded-3xl sm:p-5">
                                    <div className="text-xs uppercase tracking-[0.28em] text-slate-300">
                                        {t('visibility', 'Visibility')}
                                    </div>
                                    <div className="mt-2 break-words text-xl font-bold leading-tight text-white sm:text-2xl">
                                        {gameOptions.visibility === `private` ? `Private Lobby` : `Public Lobby`}
                                    </div>
                                </div>
                                <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4 sm:rounded-3xl sm:p-5">
                                    <div className="text-xs uppercase tracking-[0.28em] text-slate-300">
                                        {t('timeControl', 'Time Control')}
                                    </div>
                                    <div className="mt-2 break-words text-xl font-bold leading-tight text-white sm:text-2xl">
                                        {formatTimeControl(gameOptions.timeControl)}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {isTournament && playerCount < 2 && (
                        <TournamentTimerSection
                            tournament={tournament}
                            claimWinState={claimWinState}
                            opponentName={opponentName}
                        />
                    )}

                    {!isTournament && (
                        <div className="mt-6 gap-4 flex flex-col md:flex-row">
                            <Button
                                onClick={onInviteFriend}
                                variant="default" size="lg"
                                className={"w-full"}
                            >
                                {t('inviteFriend', 'Invite Friend')}
                            </Button>

                            <Button
                                onClick={onCancel}
                                variant="destructive" size="lg"
                                className={"w-full"}
                            >
                                {t('cancelLobby', 'Cancel Lobby')}
                            </Button>

                            {showOfflinePlayButton && (
                                <Button
                                    onClick={onPlayOffline}
                                    variant="success-soft" size="lg"
                                    className={"w-full"}
                                >
                                    {t('playOfflineVsBot', 'Play Offline Vs Bot')}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ScreenFooter />
        </div>
    );
}

export default WaitingScreen;
