import LeaderboardScreen from '../components/LeaderboardScreen';
import PageMetadata, { DEFAULT_PAGE_TITLE } from '../components/PageMetadata';
import { useQueryAccount } from '../query/accountClient';
import { useQueryLeaderboard } from '../query/leaderboardClient';
import { useTranslation } from 'react-i18next'

function LeaderboardRoute() {
    const { t } = useTranslation()
    const accountQuery = useQueryAccount({ enabled: true });
    const leaderboardQuery = useQueryLeaderboard({ enabled: true });

    return (
        <>
            <PageMetadata
                title={t('leaderboardDefault_page_title', 'Leaderboard • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE })}
                description={t('seeTheHighestRatedHexoPlayersAndCurrentStandings', 'See the highest rated HeXO players and current standings.')}
            />

            <LeaderboardScreen
                leaderboard={leaderboardQuery.data ?? null}
                isLoading={leaderboardQuery.isLoading || leaderboardQuery.isRefetching}
                errorMessage={leaderboardQuery.error instanceof Error ? leaderboardQuery.error.message : null}
                currentUsername={accountQuery.data?.user?.username ?? null}
            />
        </>
    );
}

export default LeaderboardRoute;
