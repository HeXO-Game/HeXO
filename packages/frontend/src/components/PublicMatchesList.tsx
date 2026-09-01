import { Button } from '@/components/ui/button';
import type { AccountProfile, LobbyInfo, LobbyOptions } from '@ih3t/shared';
import { useEffect, useState } from 'react';

import { useSsrCompatibleNow } from '../ssrState';
import { cn } from '../utils/cn';
import { formatTimeControl } from '../utils/gameTimeControl';
import { formatLobbyLiveDuration } from '../utils/lobby';
import type { RatedFilter } from '../utils/ratedFilter';
import RatedFilterTabs from './RatedFilterTabs';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useQueryAccount } from '../query/accountClient';
import { PlusIcon, ScanSearchIcon } from 'lucide-react';
import { useQueryServerShutdown } from '../query/serverClient';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'

type PublicMatchesListProps = {
    liveSessions: LobbyInfo[]
    isConnected: boolean

    onJoinGame: (sessionId: string) => void
    onCreate: (options: Partial<LobbyOptions>) => void

    className?: string
};

function ClockBadgeIcon() {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-none stroke-current">
            <circle cx="8" cy="8" r="5.25" strokeWidth="1.5" />
            <path d="M8 5.2v3.2l2.1 1.25" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}


function ModeBadgeIcon({ rated }: Readonly<{ rated: boolean }>) {
    return rated ? (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
            <path d="M8 1.9l1.7 3.46 3.82.56-2.76 2.69.65 3.8L8 10.59 4.6 12.4l.65-3.8L2.5 5.92l3.8-.56L8 1.9Z" />
        </svg>
    ) : (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current">
            <circle cx="8" cy="8" r="4.75" strokeWidth="1.5" />
            <path d="M5 8h6" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function SessionStateIcon({ startedAt }: Readonly<{ startedAt: number | null }>) {
    return startedAt ? (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-none stroke-current">
            <circle cx="8" cy="8" r="5.25" strokeWidth="1.5" />
            <path d="M6.2 5.3 10.6 8l-4.4 2.7V5.3Z" fill="currentColor" stroke="none" />
        </svg>
    ) : (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-none stroke-current">
            <path d="M5.2 2.75h5.6" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M5.2 13.25h5.6" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M6.2 3.2v2.15c0 .62.25 1.22.7 1.66L8 8.1l1.1-1.09c.45-.44.7-1.04.7-1.66V3.2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9.8 12.8V10.65c0-.62-.25-1.22-.7-1.66L8 7.9 6.9 8.99c-.45.44-.7 1.04-.7 1.66v2.15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function canJoinSession(session: LobbyInfo) {
    return session.startedAt === null && session.players.length < 2;
}

function isJoinBlockedForGuest(session: LobbyInfo, account: AccountProfile | null) {
    return session.rated && !account;
}

function isJoinBlockedForOwnRatedSeat(session: LobbyInfo, account: AccountProfile | null) {
    return session.rated
        && canJoinSession(session)
        && Boolean(account?.id)
        && session.players.some((player) => player.profileId === account?.id);
}

function getJoinButtonLabel(session: LobbyInfo, account: AccountProfile | null, isAccountLoading: boolean) {
    if (isJoinBlockedForGuest(session, account)) {
        return isAccountLoading ? `Checking Account` : i18next.t('signInRequired', 'Sign In Required');
    }

    if (isJoinBlockedForOwnRatedSeat(session, account)) {
        return i18next.t('alreadyJoined', 'Already Joined');
    }

    return canJoinSession(session) ? `Join Lobby` : `Spectate`;
}

function isJoinButtonDisabled(session: LobbyInfo, isConnected: boolean, account: AccountProfile | null) {
    return !isConnected || isJoinBlockedForGuest(session, account) || isJoinBlockedForOwnRatedSeat(session, account);
}

function formatPlayerLabel(player: LobbyInfo[`players`][number] | undefined, rated: boolean) {
    if (!player) {
        return null;
    }

    return rated ? i18next.t('displaynameElo', '{{displayName}} ({{elo}})', { displayName: player.displayName, elo: player.elo }) : player.displayName;
}

function formatSessionStatusLabel(session: LobbyInfo, now: number) {
    const duration = formatLobbyLiveDuration(session.startedAt, now);

    if (session.startedAt) {
        return duration ? i18next.t('inGameForDuration', 'In game for {{duration}}', { duration }) : i18next.t('gameInProgress', 'Game in progress');
    }

    return i18next.t('waitingForPlayers', 'Waiting for players');
}

function PlayerMatchup({ session }: { session: LobbyInfo }) {
    const { t } = useTranslation()
    const [playerOne, playerTwo] = session.players;
    if (!playerOne) {
        return (
            <div className="text-xl font-bold text-white sm:text-2xl">
                {t('waitingForPlayers', 'Waiting for players')}
            </div>
        );
    } else if (!playerTwo) {
        return (
            <div className="text-xl font-bold text-white sm:text-2xl">
                {formatPlayerLabel(playerOne, session.rated)}
            </div>
        );
    } else {
        return (
            <div className="text-xl font-bold text-white sm:text-2xl min-w-0 gap-2 flex flex-row justify-start">
                <span className="shrink min-w-0 whitespace-nowrap overscroll-contain overflow-hidden text-ellipsis">
                    {formatPlayerLabel(playerOne, session.rated)}
                </span>

                <span className="whitespace-nowrap">
                    vs
                </span>

                <span className="shrink min-w-0 whitespace-nowrap overscroll-contain overflow-hidden text-ellipsis text-right">
                    {formatPlayerLabel(playerTwo, session.rated)}
                </span>
            </div>
        );
    }
}

function LiveSessionRenderer({
    isConnected,
    session,
    onJoinGame,
}: {
    isConnected: boolean,
    session: LobbyInfo,
    onJoinGame: () => void,
}) {
    const now = useUpdatingTimestamp(1_000);

    const queryAccount = useQueryAccount();
    const account = queryAccount.data?.user ?? null;

    const canJoin = canJoinSession(session);
    const joinDisabled = isJoinButtonDisabled(session, isConnected, queryAccount.data?.user ?? null);
    const joinButtonLabel = getJoinButtonLabel(session, account, queryAccount.isLoading);
    return (
        <div
            key={session.id}
            className="group relative overflow-hidden py-4 sm:py-5"
        >
            <div className="relative flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${canJoin
                        ? `bg-emerald-400/15 text-emerald-200`
                        : `bg-sky-400/15 text-sky-200`
                        }`}
                    >
                        {canJoin ? `Lobby` : `Game`}
                        {` `}
                        {session.id}
                    </span>

                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${session.rated
                        ? `bg-amber-300/15 text-amber-100`
                        : `bg-white/8 text-slate-200`
                        }`}
                    >
                        <ModeBadgeIcon rated={session.rated} />
                        {session.rated ? `Rated` : `Unrated`}
                    </span>
                </div>

                <PlayerMatchup session={session} />

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
                            <ClockBadgeIcon />
                            {formatTimeControl(session.timeControl)}
                        </span>

                        <div className="inline-flex items-center gap-1.5 text-sm text-slate-400">
                            <SessionStateIcon startedAt={session.startedAt} />
                            {formatSessionStatusLabel(session, now)}
                        </div>
                    </div>

                    <Button
                        variant={canJoin ? `default` : `outline`}
                        size="lg"
                        onClick={onJoinGame}
                        disabled={joinDisabled}
                        className="sm:w-[15em] lg:shrink-0"
                    >
                        {joinButtonLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}

const useUpdatingTimestamp = (interval?: number) => {
    const [now, setNow] = useState(useSsrCompatibleNow());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), interval ?? 1000);
        return () => window.clearInterval(id);
    }, []);
    return now;
}

export default function PublicMatchesList({
    liveSessions,
    isConnected,

    className,

    onJoinGame,
    onCreate,
}: Readonly<PublicMatchesListProps>) {
    const { t } = useTranslation()
    const navigate = useNavigate();
    const shutdown = useQueryServerShutdown().data ?? null;

    const [activeFilter, setActiveFilter] = useState<RatedFilter>(`all`);
    const filteredSessions = liveSessions.filter((session) => {
        if (activeFilter === `rated`) {
            return session.rated;
        }

        if (activeFilter === `unrated`) {
            return !session.rated;
        }

        return true;
    });

    const hostMatch = () => {
        switch (activeFilter) {
            case "all":
                onCreate({});
                break;

            case "rated":
                onCreate({ rated: true });
                break;

            case "unrated":
                onCreate({ rated: false });
                break;
        }
    }

    let filterSummaryLabel: string;
    let emptyTitle: string;
    switch (activeFilter) {
        case `all`:
            filterSummaryLabel = t('showingAllPublicLobbiesAndOngoingMatches', 'Showing all public lobbies and ongoing matches');
            emptyTitle = t('noMatchesAvailableRightNow', 'No matches available right now');
            break;

        case `rated`:
            filterSummaryLabel = t('showingRatedPublicLobbiesAndOngoingMatchesOnly', 'Showing rated public lobbies and ongoing matches only');
            emptyTitle = t('noRatedMatchesAreAvailableRightNow', 'No rated matches are available right now');
            break;

        case `unrated`:
            filterSummaryLabel = t('showingCasualPublicLobbiesAndOngoingMatchesOnly', 'Showing casual public lobbies and ongoing matches only');
            emptyTitle = t('noCasualMatchesAreAvailableRightNow', 'No casual matches are available right now');
            break;
    }

    return (
        <Card className={cn(
            "relative flex-1 w-full ml-auto overflow-hidden min-h-110 h-full max-h-164",
            "sm:flex sm:flex-col",
            //"md:p-6",
            "xl:max-w-3xl xl:w-[60%]",
            className
        )}>
            <CardHeader>
                <CardTitle>{t('availableMatches', 'Available Matches')}</CardTitle>
                <CardDescription className={"flex flex-col gap-2"}>
                    <div>{filterSummaryLabel}</div>
                </CardDescription>
                <CardAction>
                    <Badge>{t('lengthLiveNow', '{{length}} Live Now', { length: liveSessions.length })}</Badge>
                </CardAction>
            </CardHeader>
            <CardContent className={"flex-1 flex flex-col border-y sm:mx-4 overflow-y-auto scrollbar-gutter-stable"}>
                {filteredSessions.length === 0 ? (
                    <div className="my-auto px-6 text-center text-slate-300 flex flex-col gap-4">
                        <p className="text-xl font-semibold text-white">
                            {emptyTitle}
                        </p>

                        <div className={"flex flex-col gap-2 self-center justify-center w-64 sm:w-full sm:flex-row sm:gap-4"}>
                            <Button
                                variant={"outline"}
                                className={"w-full sm:w-40"}
                                onClick={() => navigate("/sandbox")}
                            >
                                <ScanSearchIcon className={"mr-2"} /> {t('openSandbox', 'Open Sandbox')}
                            </Button>
                            <Button
                                variant={"secondary"}
                                className={"w-full sm:w-40"}
                                onClick={hostMatch}
                                disabled={shutdown !== null}
                            >
                                <PlusIcon className={"mr-2"} /> {t('createMatch', 'Create Match')}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3 divide-y">
                        {filteredSessions.map((session) => (
                            <LiveSessionRenderer
                                key={session.id}
                                isConnected={isConnected}
                                onJoinGame={() => onJoinGame(session.id)}
                                session={session}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
            <CardFooter className={"flex flex-row justify-between w-full bg-transparent border-none pt-0"}>
                <div className={"flex flex-col gap-1"}>
                    <RatedFilterTabs
                        value={activeFilter}
                        onChange={setActiveFilter}
                    />
                    <div className={"text-foreground/50 text-xs"}>{t('showingLengthLength2Matches', 'Showing {{length}} / {{length2}} matches', { length: filteredSessions.length, length2: liveSessions.length })}</div>
                </div>
                <div className={cn("flex flex-col justify-end", filteredSessions.length === 0 && "hidden")}>
                    <Button variant={"secondary"} onClick={hostMatch} disabled={shutdown !== null}>
                        <PlusIcon /> <span className={"hidden sm:inline"}>{t('createMatch', 'Create Match')}</span>
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
