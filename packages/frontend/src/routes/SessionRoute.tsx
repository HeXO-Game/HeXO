import { Button } from '@/components/ui/button';
import { createEmptyGameState, SessionId } from '@ih3t/shared';
import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useBeforeUnload, useBlocker, useNavigate, useParams } from 'react-router';
import { toast } from 'react-toastify';

import GameOverlayFinishedPlayer from '../components/GameOverlayFinishedPlayer';
import GameOverlayFinishedSpectator from '../components/GameOverlayFinishedSpectator';
import GameScreen from '../components/GameScreen';
import PageMetadata, { DEFAULT_PAGE_TITLE, PageMetadataProps } from '../components/PageMetadata';
import WaitingScreen from '../components/WaitingScreen';
import {
    acceptSessionDraw,
    declineSessionDraw,
    joinSession,
    leaveSession,
    placeCell,
    requestRematch,
    requestSessionDraw,
    sendSessionChatMessage,
    surrenderGame,
} from '../liveGameClient';
import { useLiveGameStore } from '../liveGameStore';
import { useQueryAccount, useQueryAccountPreferences } from '../query/accountClient';
import { useQueryServerShutdown } from '../query/serverClient';
import { useQuerySessionInfo } from '../query/sessionClient';
import { getBoardTheme } from '../utils/gameBoard';
import { describeSessionInvite } from '../utils/routeMetadata';
import { buildSessionPath } from './archiveRouteState';
import type { SandboxRouteState } from './sandboxRouteState';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useTranslation, Trans } from 'react-i18next'

function showErrorToast(message: string) {
    toast.error(message, {
        toastId: `error:${message}`,
    });
}

function showSuccessToast(message: string) {
    toast.success(message, {
        toastId: `success:${message}`,
    });
}

function SessionConnectingScreen({ sessionId, isConnected, onBack }: Readonly<{
    sessionId: string
    isConnected: boolean
    onBack: () => void
}>) {
    const { t } = useTranslation()
    return (
        <div className="mx-auto flex max-w-3xl items-center justify-center h-full px-4">
            <div className="w-full rounded-4xl border border-white/10 bg-slate-950/55 p-8 text-center shadow-[0_20px_80px_rgba(15,23,42,0.45)] backdrop-blur sm:p-10">
                <div className="text-xs uppercase tracking-[0.32em] text-sky-200/80">
                    {t('liveSession', 'Live Session')}
                </div>

                <h1 className="mt-4 text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
                    {t('joiningMatch', 'Joining Match')}
                </h1>

                <div className="mt-4 break-all text-lg font-bold text-sky-100 sm:text-2xl">
                    {sessionId}
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-300 sm:text-base">
                    {isConnected
                        ? t('waitingForTheServerToConfirmThisSessionIfItIsStillActiveYouWillEnterItAutomatically', 'Waiting for the server to confirm this session. If it is still active, you will enter it automatically.')
                        : t('reconnectingToTheServerSoThisSessionCanBeRestored', 'Reconnecting to the server so this session can be restored.')}
                </p>

                <Button
                    onClick={onBack}
                    variant="outline" size="lg" className="mt-8"
                >
                    {t('backToLobby', 'Back To Lobby')}
                </Button>
            </div>
        </div>
    );
}

function SessionUnavailableScreen({
    sessionId,
    title,
    message,
    primaryActionLabel,
    onPrimaryAction,
    onBack,
}: Readonly<{
    sessionId: string
    title: string
    message: string
    primaryActionLabel: string
    onPrimaryAction: () => void
    onBack: () => void
}>) {
    const { t } = useTranslation()
    return (
        <div className="mx-auto flex max-w-3xl items-center justify-center h-full px-4">
            <div className="w-full rounded-4xl border border-white/10 bg-slate-950/55 p-8 text-center shadow-[0_20px_80px_rgba(15,23,42,0.45)] backdrop-blur sm:p-10">
                <div className="text-xs uppercase tracking-[0.32em] text-amber-200/80">
                    {t('liveSession', 'Live Session')}
                </div>

                <h1 className="mt-4 text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
                    {title}
                </h1>

                <div className="mt-4 break-all text-lg font-bold text-amber-100 sm:text-2xl">
                    {sessionId}
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-300 sm:text-base">
                    {message}
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button
                        onClick={onPrimaryAction}
                        variant="secondary" size="lg"
                    >
                        {primaryActionLabel}
                    </Button>

                    <Button
                        onClick={onBack}
                        variant="outline" size="lg"
                    >
                        {t('backToLobby', 'Back To Lobby')}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function ConfirmLeaveSessionDialog({
    shown,
    onStay,
    onLeave,
}: Readonly<{
    shown: boolean,
    onStay: () => void
    onLeave: () => void
}>) {
    const { t } = useTranslation()
    return (
        <Dialog open={shown}>
            <DialogContent className={"w-full max-w-xl"} showCloseButton={false}>
                <h2 id="leave-session-title" className="text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
                    {t('leaveThisMatch', 'Leave This Match?')}
                </h2>
                <p className="text-sm leading-6 sm:text-base"><Trans i18nKey="leavingRightNowWillSurrenderTheMatchImmediatelybrStayIfYouWantToKeepPlaying">Leaving right now will surrender the match immediately.<br />
                    Stay if you want to keep playing.</Trans></p>

                <DialogFooter className={"bg-transparent"}>
                    <Button
                        onClick={onStay}
                        variant="outline" size="lg"
                        className={"w-full"}
                    >
                        {t('stayInMatch', 'Stay In Match')}
                    </Button>

                    <Button
                        onClick={onLeave}
                        variant="destructive" size="lg"
                        className={"w-full"}
                    >
                        {`Surrender `}

                        <span className="hidden sm:inline">
                            {t('andLeave', 'And Leave')}
                        </span>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function RouteMetadata() {
    const { t } = useTranslation()
    const { sessionId } = useParams<{ sessionId: SessionId }>();
    const { data: sessionInfo, isLoading: sessionInfoLoading } = useQuerySessionInfo(sessionId ?? null);
    const localParticipantId = useLiveGameStore(state => state.session?.localParticipantId);

    let metadata: Partial<PageMetadataProps>;
    if (sessionInfoLoading) {
        metadata = {
            title: t('liveSessionDefault_page_title', 'Live Session • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE }),
            description: t('joinOrSpectateALiveHexoSession', 'Join or spectate a live HeXO session.'),
            robots: 'noindex, nofollow' as const,
        };
    } else if (!sessionInfo) {
        metadata = {
            title: t('inviteExpiredDefault_page_title', 'Invite Expired • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE }),
            description: t('thisLiveSessionIsNoLongerActiveOpenTheLobbyToHostOrJoinAnotherMatch', 'This live session is no longer active. Open the lobby to host or join another match.'),
            robots: 'noindex, nofollow' as const,
        };
    } else if (localParticipantId) {
        /* Active SPA game */
        switch (sessionInfo.state.status) {
            case `lobby`:
                metadata = { title: t('lobbyIdDefault_page_title', 'Lobby {{id}} • {{DEFAULT_PAGE_TITLE}}', { id: sessionInfo.id, DEFAULT_PAGE_TITLE }) };
                break;

            case `in-game`:
                if (sessionInfo.players.some(player => player.id === localParticipantId)) {
                    metadata = { title: t('liveGameIdDefault_page_title', 'Live Game {{id}} • {{DEFAULT_PAGE_TITLE}}', { id: sessionInfo.id, DEFAULT_PAGE_TITLE }) };
                } else {
                    metadata = { title: t('spectatingGameIdDefault_page_title', 'Spectating Game {{id}} • {{DEFAULT_PAGE_TITLE}}', { id: sessionInfo.id, DEFAULT_PAGE_TITLE }) };
                }
                break;

            case `finished`:
                metadata = { title: t('finishedGameIdDefault_page_title', 'Finished Game {{id}} • {{DEFAULT_PAGE_TITLE}}', { id: sessionInfo.id, DEFAULT_PAGE_TITLE }) };
                break;
        }
    } else {
        metadata = describeSessionInvite(sessionInfo);
    }
    return (
        <PageMetadata {...metadata} />
    );
}

const kEmptyGameState = createEmptyGameState();
function SessionRoute() {
    const { t } = useTranslation()
    const { sessionId } = useParams<{ sessionId: SessionId }>();

    const navigate = useNavigate();

    const shutdown = useQueryServerShutdown().data ?? null;
    const { data: account } = useQueryAccount({ enabled: true });
    const { data: accountPreferences } = useQueryAccountPreferences({ enabled: account?.user !== null });

    const blockSessionJoinRef = useRef<boolean>(false);
    const autoPlacedOpeningTileGameKeyRef = useRef<string | null>(null);
    const handledBlockedNavigationRef = useRef(false);

    const [isChatOpen, setIsChatOpen] = useState(false);

    const connection = useLiveGameStore(state => state.connection);
    const session = useLiveGameStore(state => state.session);
    const pendingSessionJoin = useLiveGameStore(state => state.pendingSessionJoin);

    const autoPlaceOriginTile = accountPreferences?.preferences.autoPlaceOriginTile ?? false;
    const boardTheme = getBoardTheme(accountPreferences?.preferences.boardTheme);
    const hideEloInHud = accountPreferences?.preferences.zenModeInGame ?? false;
    const shouldBlockLeave = session?.state.status === `in-game` && session.localParticipantRole === `player`;

    const blocker = useBlocker(({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname);

    useEffect(() => {
        if (blocker.state !== `unblocked`) {
            return;
        }

        /* reset handled flag */
        handledBlockedNavigationRef.current = false;
    }, [blocker.state]);

    useBeforeUnload((event) => {
        if (!shouldBlockLeave) {
            return;
        }

        event.preventDefault();
        event.returnValue = ``;
    });

    /* handle the blocker in case we don't want to block */
    useEffect(() => {
        if (blocker.state !== `blocked` || shouldBlockLeave) {
            return;
        }

        if (handledBlockedNavigationRef.current) {
            return;
        }

        leaveSession();

        blockSessionJoinRef.current = true;
        handledBlockedNavigationRef.current = true;
        if (blocker.state === `blocked`) {
            blocker.proceed();
        }
    }, [
        blocker, blocker.state, shouldBlockLeave,
    ]);

    /* reset auto join when session id changed */
    useEffect(() => {
        blockSessionJoinRef.current = false;
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId || !session) {
            return;
        }

        if (session.id === sessionId) {
            return;
        }

        /* Session routing path miss match. Navigate where we should belong to */
        blockSessionJoinRef.current = true;
        void navigate(buildSessionPath(sessionId));
    }, [sessionId, session]);

    useEffect(() => {
        if (!sessionId || !connection.isInitialized || !!session) {
            return;
        }

        if (blockSessionJoinRef.current) {
            return;
        }

        joinSession(sessionId);
    }, [
        connection.isInitialized, !!session, sessionId,
    ]);

    useEffect(() => {
        if (!session?.gameState) {
            return;
        }

        if (session.state.status !== `in-game` || session.localParticipantRole !== `player`) {
            return;
        }

        if (session.gameState.currentTurnPlayerId !== session.localParticipantId) {
            return;
        }

        if (session.gameState.cells.length > 0) {
            return;
        }

        if (!autoPlaceOriginTile) {
            return;
        }

        const gameKey = t('gameidlocalparticipantid', '{{gameId}}:{{localParticipantId}}', { gameId: session.state.gameId, localParticipantId: session.localParticipantId });
        if (autoPlacedOpeningTileGameKeyRef.current === gameKey) {
            return;
        }

        autoPlacedOpeningTileGameKeyRef.current = gameKey;
        placeCell(0, 0);
    }, [
        autoPlaceOriginTile, session?.state.status, session?.gameState?.cells.length ?? 0 > 0, session?.localParticipantId,
    ]);

    if (!sessionId) {
        return (
            <Navigate to="/" replace />
        );
    }

    const retryJoinSession = () => { joinSession(sessionId); };

    const tournamentId = session?.tournament?.tournamentId ?? null;

    const leaveSessionAndNavigate = () => {
        blockSessionJoinRef.current = true;

        leaveSession();
        void navigate(tournamentId ? `/tournaments/${tournamentId}` : `/`);
    };

    const leaveSessionAndOpenOfflineBotGame = () => {
        blockSessionJoinRef.current = true;

        leaveSession();
        void navigate(`/sandbox`, {
            state: {
                botGame: {
                    engineName: `seal`,
                    botPlayerSlot: `player-2`,
                },
            } satisfies SandboxRouteState,
        });
    };

    const inviteFriend = async () => {
        const inviteUrl = new URL(`/`, window.location.origin);
        inviteUrl.searchParams.set(`join`, sessionId);

        try {
            if (navigator.share) {
                await navigator.share({
                    title: t('joinMyHexoLobby', 'Join my HeXO lobby'),
                    text: t('joinMyLobbyDirectlyWithThisLink', 'Join my lobby directly with this link.'),
                    url: inviteUrl.toString(),
                });
                showSuccessToast(`Invite link shared.`);
                return;
            }

            await navigator.clipboard.writeText(inviteUrl.toString());
            showSuccessToast(`Invite link copied to clipboard.`);
        } catch (error) {
            console.error(`Failed to share invite link:`, error);
            showErrorToast(`Failed to share invite link.`);
        }
    };

    let targetScreen: React.ReactNode = null;
    if (!connection.isInitialized) {
        targetScreen = (
            <SessionConnectingScreen
                sessionId={sessionId}
                isConnected={connection.isConnected}
                onBack={leaveSessionAndNavigate}
            />
        );
    } else if (session?.state.status === `lobby`) {
        if (session.localParticipantRole === `spectator`) {
            targetScreen = (
                <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center text-white">
                    <div className="inline-flex rounded-full border border-sky-300/30 bg-sky-300/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200">
                        {t('spectating', 'Spectating')}
                    </div>

                    <h2 className="mt-5 text-2xl font-black uppercase tracking-[0.06em] sm:text-4xl">
                        {t('waitingForMatchToStart', 'Waiting for match to start')}
                    </h2>

                    <p className="mt-3 text-sm text-slate-400">
                        {t('thePlayersHaventStartedYetYoullBeAbleToSpectateOnceTheGameBegins', "The players haven't started yet. You'll be able to spectate once the game begins.")}
                    </p>

                    <div className="mt-3 text-[11px] tabular-nums text-slate-500">
                        {t('playersReady', 'Players ready:')}
                        {` `}{t('length2', '{{length}}\n                        /2', { length: session.players.length })}</div>

                    <Button
                        onClick={leaveSessionAndNavigate}
                        variant="ghost" size="bare" className="mt-6"
                    >
                        {t('leave', 'Leave')}
                    </Button>
                </div>
            );
        } else {
            const localPlayer = session.players.find(player => player.id === session.localParticipantId);
            const localPlayerName = localPlayer?.displayName ?? account?.user?.username ?? `unknown`;
            const localProfileId = localPlayer?.profileId ?? account?.user?.id ?? null;

            targetScreen = (
                <WaitingScreen
                    sessionId={session.id}
                    gameOptions={session.gameOptions}

                    playerCount={session.players.length}
                    localPlayerName={localPlayerName}
                    localProfileId={localProfileId}
                    tournament={session.tournament}
                    onInviteFriend={() => void inviteFriend()}
                    onPlayOffline={session.gameOptions.visibility === `public` ? leaveSessionAndOpenOfflineBotGame : undefined}
                    onCancel={leaveSessionAndNavigate}
                />
            );
        }
    } else if (session?.state.status === `in-game` && !session.gameState) {
        /* show the connecting game screen until we got the game state */
        targetScreen = (
            <SessionConnectingScreen
                sessionId={sessionId}
                isConnected={connection.isConnected}
                onBack={leaveSessionAndNavigate}
            />
        );
    } else if (session) {
        let screenOverlay: React.ReactNode;
        if (session.state.status !== `finished`) {
            /* do not display an overlay */
            screenOverlay = null;
        } else if (session.localParticipantRole === `spectator`) {
            screenOverlay = (
                <GameOverlayFinishedSpectator
                    state={session.state}
                    players={session.players}

                    onReturnToLobby={leaveSessionAndNavigate}
                />
            );
        } else {
            screenOverlay = (
                <GameOverlayFinishedPlayer
                    state={session.state}
                    players={session.players}
                    localPlayerId={session.localParticipantId}
                    isTournament={Boolean(session.tournament)}

                    onReturnToLobby={leaveSessionAndNavigate}
                    onRequestRematch={session.tournament ? undefined : requestRematch}
                />
            );
        }

        /*
         * Game state can be null if not yet received and game has finished.
         * Opting in to show the finish overlay already with an empty game in the background
         */
        const gameState = session.gameState ?? kEmptyGameState;

        targetScreen = (
            <GameScreen
                sessionId={session.id}

                players={session.players}
                currentPlayerId={session.localParticipantId}
                participantRole={session.localParticipantRole}

                gameId={session.state.gameId}
                gameOptions={session.gameOptions}
                gameState={gameState}

                shutdown={shutdown}
                showConnectionUnstableBadge={connection.isUnstable}

                chat={session.chat}
                isChatOpen={isChatOpen}
                onChatOpenChange={setIsChatOpen}

                drawRequest={session.state.status === `in-game` ? session.state.drawRequest : null}
                drawRequestAvailableAfterTurn={session.state.status === `in-game` ? session.state.drawRequestAvailableAfterTurn : 0}
                onDrawRequest={session.localParticipantRole === `player` && session.state.status === `in-game` ? requestSessionDraw : undefined}
                onDrawAccept={session.localParticipantRole === `player` && session.state.status === `in-game` ? acceptSessionDraw : undefined}
                onDrawDecline={session.localParticipantRole === `player` && session.state.status === `in-game` ? declineSessionDraw : undefined}

                interactionEnabled={session.state.status === `in-game`}
                theme={boardTheme}
                hideEloInHud={hideEloInHud}
                tournament={session.tournament}

                onPlaceCell={placeCell}
                onSendChatMessage={session.localParticipantRole === `player` ? sendSessionChatMessage : undefined}

                leaveLabel={session.localParticipantRole === `player` ? `Surrender` : `Leave Game`}
                onLeave={session.localParticipantRole === `player` && session.state.status === `in-game` ? surrenderGame : leaveSessionAndNavigate}

                overlay={screenOverlay}
            />
        );
    } else if (pendingSessionJoin.status === `failed`) {
        targetScreen = (
            <SessionUnavailableScreen
                sessionId={sessionId}
                title={t('sessionUnavailable', 'Session Unavailable')}
                message={pendingSessionJoin.errorMessage ?? t('theSessionCouldNotBeOpenedRightNowYouCanRetryOrReturnToTheLobby', 'The session could not be opened right now. You can retry or return to the lobby.')}
                primaryActionLabel="Retry"
                onPrimaryAction={retryJoinSession}
                onBack={leaveSessionAndNavigate}
            />
        );
    } else if (pendingSessionJoin.status === `not-found`) {
        targetScreen = (
            <SessionUnavailableScreen
                sessionId={sessionId}
                title={t('sessionNotFound2', 'Session Not Found')}
                message="This live session does not exist anymore. It may have finished already, been closed, or the link may be incorrect."
                primaryActionLabel="Try Again"
                onPrimaryAction={retryJoinSession}
                onBack={leaveSessionAndNavigate}
            />
        );
    } else {
        /* fallback */
        targetScreen = (
            <SessionConnectingScreen
                sessionId={sessionId}
                isConnected={connection.isConnected}
                onBack={leaveSessionAndNavigate}
            />
        );
    }

    return (
        <React.Fragment>
            <RouteMetadata />
            {targetScreen}
            <ConfirmLeaveSessionDialog
                shown={blocker.state === `blocked` && shouldBlockLeave}
                onStay={() => {
                    blocker.reset?.();
                }}
                onLeave={() => {
                    if (handledBlockedNavigationRef.current || blocker.state !== `blocked`) {
                        /* already handled */
                        return;
                    }


                    blockSessionJoinRef.current = true;
                    handledBlockedNavigationRef.current = true;
                    leaveSession();

                    if (blocker.state === `blocked`) {
                        blocker.proceed();
                    }
                }}
            />
        </React.Fragment>
    );
}

export default SessionRoute;
