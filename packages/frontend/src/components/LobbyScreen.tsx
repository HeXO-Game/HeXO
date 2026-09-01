import { Button } from '@/components/ui/button';
import type { AccountProfile, CreateSessionRequest, LobbyInfo, ShutdownState } from '@ih3t/shared';
import { useState } from 'react';

import { useHydratedDelay } from '../useHydratedDelay';
import CreateLobbyDialog from './CreateLobbyDialog';
import ShutdownTimer from './game-screen/ShutdownTimer';
import PublicMatchesList from './PublicMatchesList';
import ScreenFooter from './ScreenFooter';
import { cn } from '../utils/cn';
import { useTranslation, Trans } from 'react-i18next'

type LobbyScreenProps = {
    isConnected: boolean
    shutdown: ShutdownState | null
    account: AccountProfile | null
    isAccountLoading: boolean
    liveSessions: LobbyInfo[]
    unreadChangelogEntries: number
    onHostGame: (request: CreateSessionRequest) => void
    onJoinGame: (sessionId: string) => void
    onOpenSandbox: () => void
    onViewFinishedGames: () => void
    onViewLeaderboard: () => void
    onViewTournaments: () => void
    onViewChangelog: () => void
    onViewOwnFinishedGames: () => void
};

function ChangelogLinkIcon() {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current">
            <path d="M4.5 8h7" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M8.8 4.7 12.1 8l-3.3 3.3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function LobbyScreen({
    isConnected,
    shutdown,
    account,
    liveSessions,
    unreadChangelogEntries,
    onHostGame,
    onJoinGame,
    onViewChangelog,
}: Readonly<LobbyScreenProps>) {
    const { t } = useTranslation()
    const [isCreateLobbyDialogOpen, setIsCreateLobbyDialogOpen] = useState(false);
    const showClientBadges = useHydratedDelay(500);

    return (
        <div className="flex grow sm:h-full flex-col px-4 py-4 text-white sm:px-6 sm:py-6">
            <CreateLobbyDialog
                isOpen={isCreateLobbyDialogOpen}
                onClose={() => setIsCreateLobbyDialogOpen(false)}
                account={account}
                onCreateLobby={onHostGame}
            />

            <div className={cn(
                "relative z-10 mt-4 w-full flex flex-col flex-1 items-stretch justify-center self-center gap-5",
                "md:gap-8",
                "xl:flex-row xl:mt-[7vh]"
            )}>
                <section className="relative flex flex-col max-w-xl w-full xl:w-[40%] px-2 xl:p-6 xl:min-w-130">
                    <h1 className="mt-5 text-3xl font-black uppercase tracking-[0.08em] text-white sm:mt-6 sm:text-5xl lg:text-6xl">
                        {t('hexo', 'HeXO')}
                    </h1>

                    <h2 className="mt-1 text-xl font-black uppercase tracking-[0.08em] text-white sm:text-2xl lg:mt-3 lg:text-3xl">
                        <Trans t={t} i18nKey="theInfiniteHexagonalBrTictactoeGame">
                            The infinite hexagonal
                            <br />
                            tic-tac-toe game
                        </Trans>
                    </h2>

                    <p className="mt-5 max-w-xl text-sm leading-6 text-slate-200 sm:mt-6 sm:text-base sm:leading-7 lg:text-lg">
                        <Trans t={t} i18nKey="spanClassnamehiddenhexospanIsATwoplayerStrategyGamePlayedOnAnInfiniteHexagonalGridTakeTurnsPlacingYourPiecesBuildAndBlockLinesAndBeTheFirstToConnectSixInARow">
                            <span className={"hidden"}>HeXO</span> is a two-player strategy game played on an infinite hexagonal grid. Take turns placing your pieces, build and block lines, and be the first to connect six in a row.
                        </Trans>
                    </p>

                    <div className="mt-6 flex flex-col gap-4">
                        {showClientBadges && !isConnected && (
                            <div className="inline-flex items-center rounded-md border text-left border-rose-300/40 bg-rose-300/10 px-4 py-3 text-sm font-medium text-rose-400">
                                {t('notConnectedToServer', 'Not connected to server')}
                            </div>
                        )}

                        {showClientBadges && shutdown && (
                            <div className="inline-flex items-center rounded-md border text-left border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-400">
                                {t('newMatchesAreDisabledUntilTheRestartCompletes', 'New matches are disabled until the restart completes:')} <ShutdownTimer shutdown={shutdown} />
                            </div>
                        )}
                    </div>

                    {unreadChangelogEntries > 0 && (
                        <Button
                            type="button"
                            onClick={onViewChangelog}
                            variant="info" size="default" className="mt-5 self-start gap-3 text-left"
                        >
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.6)]" />

                            <span className="flex flex-col">
                                <span className="font-semibold">
                                    {t('newFeaturesDropped', {
                                        defaultValue_one: '{{count}} new feature dropped',
                                        defaultValue_other: '{{count}} new features dropped',
                                        count: unreadChangelogEntries,
                                    })}
                                </span>

                                <span className="text-xs uppercase tracking-[0.18em] text-sky-200/85">
                                    {t('viewChangelog', 'View changelog')}
                                </span>
                            </span>

                            <span className="ml-1 shrink-0 text-sky-200/85">
                                <ChangelogLinkIcon />
                            </span>
                        </Button>
                    )}
                </section>

                <PublicMatchesList
                    liveSessions={liveSessions}
                    isConnected={isConnected}

                    onJoinGame={onJoinGame}
                    onCreate={options => setIsCreateLobbyDialogOpen(true)}

                    className="lg:col-span-7"
                />
            </div>

            <ScreenFooter />
        </div >
    );
}

export default LobbyScreen;
