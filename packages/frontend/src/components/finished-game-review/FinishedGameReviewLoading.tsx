import FinishedGameReviewLayout from './FinishedGameReviewLayout';
import { useTranslation } from 'react-i18next'

type FinishedGameReviewLoadingProps = {
    onRetry: () => void
};

function FinishedGameReviewLoading({
    onRetry,
}: Readonly<FinishedGameReviewLoadingProps>) {
    const { t } = useTranslation()
    return (
        <FinishedGameReviewLayout onRetry={onRetry}>
            <div className="flex flex-1 items-center justify-center rounded-4xl border border-white/10 bg-white/6 text-lg text-slate-200 shadow-[0_20px_80px_rgba(15,23,42,0.45)] backdrop-blur">
                {t('loadingReplay', 'Loading replay...')}
            </div>
        </FinishedGameReviewLayout>
    );
}

export default FinishedGameReviewLoading;
