import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import FinishedGamesScreen from '../components/FinishedGamesScreen';
import PageMetadata, { DEFAULT_PAGE_TITLE } from '../components/PageMetadata';
import { useQueryAccount } from '../query/accountClient';
import { useQueryFinishedGames } from '../query/finishedGamesClient';
import { buildFinishedGamePath, buildFinishedGamesPath, useArchiveRouteState } from './archiveRouteState';
import { useTranslation } from 'react-i18next'

function FinishedGamesRoute() {
    const { t } = useTranslation()
    const navigate = useNavigate();
    const archiveRouteState = useArchiveRouteState();
    const accountQuery = useQueryAccount({ enabled: Boolean(archiveRouteState) });
    const isOwnArchive = archiveRouteState?.archiveView === `mine`;
    const finishedGamesQuery = useQueryFinishedGames(
        archiveRouteState?.archivePage ?? 1,
        archiveRouteState?.archiveBaseTimestamp ?? Date.now(),
        archiveRouteState?.archiveView ?? `all`,
        archiveRouteState?.ratedFilter ?? `all`,
        { enabled: Boolean(archiveRouteState) && (!isOwnArchive || Boolean(accountQuery.data?.user)) },
    );

    useEffect(() => {
        if (!archiveRouteState || !finishedGamesQuery.data) {
            return;
        }

        if (archiveRouteState.archivePage > finishedGamesQuery.data.pagination.totalPages) {
            void navigate(
                buildFinishedGamesPath(
                    finishedGamesQuery.data.pagination.totalPages,
                    archiveRouteState.archiveBaseTimestamp,
                    archiveRouteState.archiveView,
                    archiveRouteState.ratedFilter,
                ),
                { replace: true },
            );
        }
    }, [
        archiveRouteState, finishedGamesQuery.data, navigate,
    ]);

    if (!archiveRouteState) {
        return null;
    }

    return (
        <>
            <PageMetadata
                {...(isOwnArchive
                    ? {
                        title: t('myMatchHistoryDefault_page_title', 'My Match History • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE }),
                        description: t('reviewYourOwnFinishedHexoMatchesWhileSignedIn', 'Review your own finished HeXO matches while signed in.'),
                        robots: 'noindex, nofollow' as const,
                    }
                    : {
                        title: t('finishedGamesArchiveDefault_page_title', 'Finished Games Archive • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE }),
                        description: t('browseFinishedHexoMatchesAndReviewTheirMoveHistory', 'Browse finished HeXO matches and review their move history.'),
                    })}
            />

            <FinishedGamesScreen
                archive={finishedGamesQuery.data ?? null}
                isLoading={isOwnArchive ? accountQuery.isLoading || finishedGamesQuery.isLoading : finishedGamesQuery.isLoading}
                errorMessage={finishedGamesQuery.error instanceof Error ? finishedGamesQuery.error.message : null}
                archiveView={archiveRouteState.archiveView}
                currentProfileId={accountQuery.data?.user?.id ?? null}
                requiresSignIn={isOwnArchive && !accountQuery.data?.user}
                showSignInHint={!isOwnArchive && !accountQuery.isLoading && !accountQuery.data?.user}
                onOpenGame={(gameId) => void navigate(
                    buildFinishedGamePath(
                        gameId,
                        archiveRouteState.archiveView,
                    ),
                )}
                onChangePage={(nextArchivePage) => void navigate(
                    buildFinishedGamesPath(
                        nextArchivePage,
                        archiveRouteState.archiveBaseTimestamp,
                        archiveRouteState.archiveView,
                        archiveRouteState.ratedFilter,
                    ),
                    { replace: true },
                )}
                onRefresh={() => void navigate(
                    buildFinishedGamesPath(1, Date.now(), archiveRouteState.archiveView, archiveRouteState.ratedFilter),
                    { replace: true },
                )}
                ratedFilter={archiveRouteState.ratedFilter}
                onChangeRatedFilter={(ratedFilter) => void navigate(
                    buildFinishedGamesPath(1, Date.now(), archiveRouteState.archiveView, ratedFilter),
                    { replace: true },
                )}
            />
        </>
    );
}

export default FinishedGamesRoute;
