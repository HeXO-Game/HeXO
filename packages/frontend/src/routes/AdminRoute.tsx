import { Navigate, useNavigate } from 'react-router';

import AdminStatsScreen from '../components/AdminStatsScreen';
import PageMetadata, { DEFAULT_PAGE_TITLE } from '../components/PageMetadata';
import { useQueryAccount } from '../query/accountClient';
import { useQueryAdminStats } from '../query/adminClient';
import { useTranslation } from 'react-i18next'

function AdminRoute() {
    const { t } = useTranslation()
    const navigate = useNavigate();
    const accountQuery = useQueryAccount({ enabled: true });
    const isAdmin = accountQuery.data?.user?.role === `admin`;
    const timezoneOffsetMinutes = new Date().getTimezoneOffset();
    const adminStatsQuery = useQueryAdminStats(timezoneOffsetMinutes, {
        enabled: !accountQuery.isLoading && isAdmin,
    });

    if (accountQuery.isLoading) {
        return (
            <>
                <PageMetadata
                    title={t('adminDashboardDefault_page_title', 'Admin Dashboard • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE })}
                    description={t('administrativeStatisticsForHexo', 'Administrative statistics for HeXO.')}
                    robots="noindex, nofollow"
                />

                <AdminStatsScreen
                    stats={null}
                    isLoading
                    errorMessage={null}
                    onRefresh={() => void adminStatsQuery.refetch()}
                    onOpenGame={(gameId) => void navigate(`/games/${encodeURIComponent(gameId)}`)}
                />
            </>
        );
    }

    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    return (
        <>
            <PageMetadata
                title={t('adminDashboardDefault_page_title', 'Admin Dashboard • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE })}
                description={t('administrativeStatisticsForHexo', 'Administrative statistics for HeXO.')}
                robots="noindex, nofollow"
            />

            <AdminStatsScreen
                stats={adminStatsQuery.data ?? null}
                isLoading={adminStatsQuery.isLoading || adminStatsQuery.isRefetching}
                errorMessage={adminStatsQuery.error instanceof Error ? adminStatsQuery.error.message : null}
                onRefresh={() => void adminStatsQuery.refetch()}
                onOpenGame={(gameId) => void navigate(`/games/${encodeURIComponent(gameId)}`)}
            />
        </>
    );
}

export default AdminRoute;
