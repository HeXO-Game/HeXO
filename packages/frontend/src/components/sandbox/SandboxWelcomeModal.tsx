import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next'
type SandboxWelcomeModalProps = {
    open: boolean
    onStartCleanBoard: () => void
    onImportPosition: () => void
};

function SandboxWelcomeModal({
    open,
    onStartCleanBoard,
    onImportPosition,
}: Readonly<SandboxWelcomeModalProps>) {
    const { t } = useTranslation()

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onStartCleanBoard(); }}>
            <DialogContent showCloseButton={false} className="block max-h-[calc(100dvh-2rem)] overflow-y-auto text-white w-[calc(100%-2rem)] max-w-lg rounded-[1.75rem] border border-emerald-300/25 bg-slate-900/95 px-6 py-6 text-center shadow-[0_30px_120px_rgba(15,23,42,0.58)] backdrop-blur sm:px-8 sm:py-8">
                <DialogTitle className="text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
                    {t('localFreePlay', 'Local Free Play')}
                </DialogTitle>

                <DialogDescription className="mt-4 text-sm leading-6 text-slate-200 sm:text-base">
                    {t('sandboxModeIsALocalBoardWithNoClockControlBothPlayersYourselfHandEitherSideToABotAndResetAnyTimeStartFromAnEmptyBoardOrLoadASharedPosition', 'Sandbox mode is a local board with no clock. Control both players yourself, hand either side to a bot, and reset any time. Start from an empty board or load a shared position.')}
                </DialogDescription>

                <div className="mt-6 grid sm:grid-cols-2 gap-4">
                    <Button
                        onClick={onImportPosition}
                        variant="outline" size="lg" className="w-full flex-1"
                    >
                        <span className={"overflow-hidden whitespace-nowrap text-ellipsis"}>
                            {t('importPosition', 'Import Position')}
                        </span>
                    </Button>

                    <Button
                        onClick={onStartCleanBoard}
                        variant="success" size="lg" className="w-full flex-1"
                    >
                        <span className={"overflow-hidden whitespace-nowrap text-ellipsis"}>
                            {t('newBoard', 'New Board')}
                        </span>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default SandboxWelcomeModal;
