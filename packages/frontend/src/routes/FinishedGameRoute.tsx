import { Navigate, useLocation, useParams } from 'react-router';

import FinishedGameReplayView from '../components/finished-game-review/FinishedGameReplayView';
import FinishedGameReviewError from '../components/finished-game-review/FinishedGameReviewError';
import FinishedGameReviewLoading from '../components/finished-game-review/FinishedGameReviewLoading';
import FinishedGameReviewNotFound from '../components/finished-game-review/FinishedGameReviewNotFound';
import PageMetadata, { DEFAULT_PAGE_TITLE } from '../components/PageMetadata';
import { useQueryAccount, useQueryAccountPreferences } from '../query/accountClient';
import { useQueryFinishedGame } from '../query/finishedGamesClient';
import { getBoardTheme } from '../utils/gameBoard';
import { describeFinishedGameMetadata } from '../utils/routeMetadata';
import { useTranslation } from 'react-i18next'

function FinishedGameRoute() {
    const { t } = useTranslation()
    const { gameId } = useParams<{ gameId: string }>();
    const location = useLocation();
    const accountQuery = useQueryAccount({ enabled: Boolean(gameId) });
    const accountPreferencesQuery = useQueryAccountPreferences({
        enabled: Boolean(accountQuery.data?.user),
    });
    const { data: game, isLoading, error, refetch } = useQueryFinishedGame(gameId ?? null, {
        enabled: Boolean(gameId),
    });
    const isOwnReplay = location.pathname.startsWith(`/account/`);

    if (!gameId) {
        return <Navigate to="/" replace />;
    }

    const onRetry = () => void refetch();
    const errorMessage = error instanceof Error ? error.message : null;

    return (
        <>
            <PageMetadata
                {...(game
                    ? describeFinishedGameMetadata(game, isOwnReplay)
                    : !isLoading
                        ? {
                            title: t('replayNotFoundDefault_page_title', 'Replay Not Found • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE }),
                            description: t('theRequestedFinishedMatchCouldNotBeFound', 'The requested finished match could not be found.'),
                            ogType: `article` as const,
                            robots: 'noindex, nofollow' as const,
                        }
                        : {
                            title: t('valDefault_page_title', '{{val}} • {{DEFAULT_PAGE_TITLE}}', { val: isOwnReplay ? `My Replay` : `Replay`, DEFAULT_PAGE_TITLE }),
                            description: isOwnReplay
                                ? t('reviewYourFinishedHexoMatches', 'Review your finished HeXO matches.')
                                : t('reviewAFinishedHexoMatch', 'Review a finished HeXO match.'),
                            ogType: `article` as const,
                            robots: isOwnReplay ? 'noindex, nofollow' as const : `index, follow` as const,
                        })}
            />

            {isLoading ? (
                <FinishedGameReviewLoading onRetry={onRetry} />
            ) : errorMessage ? (
                <FinishedGameReviewError errorMessage={errorMessage} onRetry={onRetry} />
            ) : game ? (
                <FinishedGameReplayView
                    game={game}
                    theme={getBoardTheme(accountPreferencesQuery.data?.preferences.boardTheme)}
                    onRetry={onRetry}
                />
            ) : (
                <FinishedGameReviewNotFound onRetry={onRetry} />
            )}
        </>
    );
}

export default FinishedGameRoute;
