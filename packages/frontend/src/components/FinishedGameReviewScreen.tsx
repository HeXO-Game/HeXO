import type { BoardTheme } from '@ih3t/board-renderer';
import type { FinishedGameRecord } from '@ih3t/shared';

import FinishedGameReplayView from './finished-game-review/FinishedGameReplayView';
import FinishedGameReviewError from './finished-game-review/FinishedGameReviewError';
import FinishedGameReviewLoading from './finished-game-review/FinishedGameReviewLoading';
import FinishedGameReviewNotFound from './finished-game-review/FinishedGameReviewNotFound';

type FinishedGameReviewScreenProps = {
    game: FinishedGameRecord | null
    isLoading: boolean
    errorMessage: string | null
    theme: BoardTheme
    onRetry: () => void
};

function FinishedGameReviewScreen({
    game,
    isLoading,
    errorMessage,
    theme,
    onRetry,
}: Readonly<FinishedGameReviewScreenProps>) {
    if (isLoading) {
        return <FinishedGameReviewLoading onRetry={onRetry} />;
    }

    if (errorMessage) {
        return <FinishedGameReviewError errorMessage={errorMessage} onRetry={onRetry} />;
    }

    if (!game) {
        return <FinishedGameReviewNotFound onRetry={onRetry} />;
    }

    return <FinishedGameReplayView game={game} onRetry={onRetry} theme={theme} />;
}

export default FinishedGameReviewScreen;
