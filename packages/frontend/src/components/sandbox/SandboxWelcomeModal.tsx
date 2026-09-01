import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next'
type SandboxWelcomeModalProps = {
    isOpen: boolean
    onStartCleanBoard: () => void
    onImportPosition: () => void
};

function SandboxWelcomeModal({
    isOpen,
    onStartCleanBoard,
    onImportPosition,
}: Readonly<SandboxWelcomeModalProps>) {
    const { t } = useTranslation()
    if (!isOpen) {
        return null;
    }

    return (
        <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="pointer-events-auto w-full max-w-lg rounded-[1.75rem] border border-emerald-300/25 bg-slate-900/95 px-6 py-6 text-center shadow-[0_30px_120px_rgba(15,23,42,0.58)] backdrop-blur sm:px-8 sm:py-8">
                <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-emerald-100">
                    {t('sandboxMode', 'Sandbox Mode')}
                </div>

                <h1 className="mt-5 text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
                    {t('localFreePlay', 'Local Free Play')}
                </h1>

                <p className="mt-4 text-sm leading-6 text-slate-200 sm:text-base">
                    {t('sandboxModeIsALocalBoardWithNoClockControlBothPlayersYourselfHandEitherSideToABotAndResetAnyTimeStartFromAnEmptyBoardOrLoadASharedPosition', 'Sandbox mode is a local board with no clock. Control both players yourself, hand either side to a bot,\n                    and reset any time. Start from an empty board or load a shared position.')}
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button
                        onClick={onImportPosition}
                        variant="outline" size="lg" className="w-full"
                    >
                        {t('importPosition', 'Import Position')}
                    </Button>

                    <Button
                        onClick={onStartCleanBoard}
                        variant="success" size="lg" className="w-full"
                    >
                        {t('newBoard', 'New Board')}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default SandboxWelcomeModal;
