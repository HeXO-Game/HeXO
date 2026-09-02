import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import PageMetadata, { DEFAULT_PAGE_TITLE } from '../components/PageMetadata';
import ProfileScreen from '../components/ProfileScreen';
import {
    useQueryAccount,
    useQueryProfile,
    useQueryProfileStatistics,
} from '../query/accountClient';
import { useQueryPublicProfileGames as useQueryProfileGames } from '../query/finishedGamesClient';
import { useQueryAvailableSessions } from '../query/sessionClient';
import { useTranslation } from 'react-i18next'
import type { FinishedGamesRatedFilter } from '../query/queryDefinitions';

function ProfileRoute() {
    const { t } = useTranslation()
    const { profileId } = useParams<{ profileId: string }>();
    const isPublicProfileRoute = Boolean(profileId);

    const accountQuery = useQueryAccount({ enabled: true });
    const targetProfileId = profileId ?? accountQuery.data?.user?.id ?? null;
    const [gamesPage, setGamesPage] = useState(1);
    const [gamesBaseTimestamp, setGamesBaseTimestamp] = useState(() => Date.now());
    const [gamesRatedFilter, setGamesRatedFilter] = useState<FinishedGamesRatedFilter>(`all`);

    const profileQuery = useQueryProfile(targetProfileId);
    const profileStatisticsQuery = useQueryProfileStatistics(targetProfileId);
    const recentGamesQuery = useQueryProfileGames(
        targetProfileId,
        gamesPage,
        gamesBaseTimestamp,
        gamesRatedFilter,
    );

    useEffect(() => {
        setGamesPage(1);
        setGamesBaseTimestamp(Date.now());
        setGamesRatedFilter(`all`);
    }, [targetProfileId]);

    useEffect(() => {
        const totalPages = recentGamesQuery.data?.pagination.totalPages;
        if (totalPages && gamesPage > totalPages) {
            setGamesPage(totalPages);
        }
    }, [gamesPage, recentGamesQuery.data]);

    const availableSessionsQuery = useQueryAvailableSessions();

    const liveGame = availableSessionsQuery.data?.find((session) =>
        session.startedAt !== null && session.players.some((player) => player.profileId === targetProfileId)) ?? null;

    const error = profileQuery.error;
    const statisticsError = profileStatisticsQuery.error;
    return (
        <>
            <PageMetadata
                {...(isPublicProfileRoute
                    ? profileQuery.data?.user
                        ? {
                            title: t('usernamePlayerProfileDefault_page_title', '{{username}} • Player Profile • {{DEFAULT_PAGE_TITLE}}', { username: profileQuery.data.user.username, DEFAULT_PAGE_TITLE }),
                            description: t('viewUsernamesPublicHexoProfileAndCompetitiveStanding', 'View {{username}}\'s public HeXO profile and competitive standing.', { username: profileQuery.data.user.username }),
                            ogType: `article` as const,
                        }
                        : !profileQuery.isLoading
                            ? {
                                title: t('profileNotFoundDefault_page_title', 'Profile Not Found • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE }),
                                description: t('theRequestedPlayerProfileCouldNotBeFound', 'The requested player profile could not be found.'),
                                ogType: `article` as const,
                                robots: 'noindex, nofollow' as const,
                            }
                            : {
                                title: t('playerProfileDefault_page_title', 'Player Profile • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE }),
                                description: t('viewAPublicHexoPlayerProfile', 'View a public HeXO player profile.'),
                                ogType: `article` as const,
                            }
                    : {
                        title: t('myProfileDefault_page_title', 'My Profile • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE }),
                        description: t('signInToOpenYourOwnHexoProfile', 'Sign in to open your own HeXO profile.'),
                        robots: 'noindex, nofollow' as const,
                    })}
            />

            <ProfileScreen
                account={profileQuery.data?.user ?? null}
                statistics={profileStatisticsQuery.data?.statistics ?? null}
                recentGames={recentGamesQuery.data ?? null}
                liveGame={liveGame}
                isLoading={profileQuery.isLoading}
                isStatisticsLoading={profileStatisticsQuery.isLoading}
                isRecentGamesLoading={recentGamesQuery.isLoading || recentGamesQuery.isRefetching}
                errorMessage={error instanceof Error ? error.message : null}
                statisticsErrorMessage={statisticsError instanceof Error ? statisticsError.message : null}
                recentGamesErrorMessage={recentGamesQuery.error instanceof Error ? recentGamesQuery.error.message : null}
                isPublicView={isPublicProfileRoute}
                gamesRatedFilter={gamesRatedFilter}
                onChangeGamesRatedFilter={(ratedFilter) => {
                    setGamesRatedFilter(ratedFilter);
                    setGamesPage(1);
                    setGamesBaseTimestamp(Date.now());
                }}
                onChangeGamesPage={(page) => {
                    setGamesBaseTimestamp(
                        recentGamesQuery.data?.pagination.baseTimestamp ?? gamesBaseTimestamp,
                    );
                    setGamesPage(page);
                }}
            />
        </>
    );
}

export default ProfileRoute;
