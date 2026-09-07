import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import type { SandboxPositionResponse } from '@ih3t/shared';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../query/queryDefinitions';
import { fetchSandboxPosition } from '../../query/sandboxClient';
import { extractSandboxPositionId } from '../../sandbox/sandboxPositionId';
import { useTranslation } from 'react-i18next'

type SandboxImportModalProps = {
    open: boolean
    onClose: () => void
    onImport: (position: SandboxPositionResponse) => void
};

function SandboxImportModal({ open, onClose, onImport }: Readonly<SandboxImportModalProps>) {
    const { t } = useTranslation()
    const queryClient = useQueryClient();
    const [inputValue, setInputValue] = useState(``);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const session = useRef(0);
    useEffect(() => {
        setInputValue(``);
        setIsLoading(false);
        setErrorMessage(null);
        return () => { session.current += 1; };
    }, [open]);


    const importPosition = async (positionId: string) => {
        const currentSession = session.current;
        setErrorMessage(null);
        setIsLoading(true);
        try {
            const response = await queryClient.fetchQuery({
                queryKey: queryKeys.sandboxPosition(positionId),
                queryFn: () => fetchSandboxPosition(positionId),
                staleTime: 60 * 60 * 1000,
            });
            if (currentSession === session.current) {
                onImport(response);
            }
        } catch (error) {
            if (currentSession !== session.current) return;
            setErrorMessage(error instanceof Error ? error.message : `Failed to load sandbox position.`);
        } finally {
            if (currentSession === session.current) setIsLoading(false);
        }
    };

    const parsedPositionId = extractSandboxPositionId(inputValue);
    const hasInput = inputValue.trim().length > 0;
    const validationMessage = hasInput && !parsedPositionId
        ? t('enterAValidSandboxPositionIdOrLink', 'Enter a valid sandbox position id or link.')
        : null;
    const visibleErrorMessage = validationMessage ?? errorMessage;

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isLoading) onClose(); }}>
            <DialogContent showCloseButton={false} className="block max-h-[calc(100dvh-2rem)] overflow-y-auto text-white w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-sky-300/20 bg-slate-900/95 px-6 py-6 shadow-[0_30px_120px_rgba(15,23,42,0.58)] backdrop-blur sm:px-8 sm:py-8">
                <DialogTitle className="text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
                    {t('importPosition', 'Import Position')}
                </DialogTitle>

                <DialogDescription className="mt-4 text-sm leading-6 text-slate-200 sm:text-base">
                    {t('pasteASharedSandboxIdOrAFullSandboxLinkToLoadThatPositionOntoYourBoard', 'Paste a shared sandbox ID or a full sandbox link to load that position onto your board.')}
                </DialogDescription>

                <input
                    value={inputValue}
                    onChange={(event) => {
                        setInputValue(event.target.value);
                        setErrorMessage(null);
                    }}
                    placeholder={t('abc1234OrHttps', 'abc1234 or https://...')}
                    autoFocus
                    className="mt-6 w-full rounded-2xl border border-sky-300/15 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition placeholder:text-slate-500 focus:border-sky-300/40 focus:bg-slate-950 focus:ring-2 focus:ring-sky-300/12"
                    style={{ colorScheme: `dark` }}
                />

                {visibleErrorMessage && (
                    <div className="mt-3 rounded-2xl border border-rose-600/60 bg-rose-500/10 px-4 py-3 text-left text-sm text-rose-600">
                        {visibleErrorMessage}
                    </div>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button
                        onClick={onClose}
                        disabled={isLoading}
                        variant="outline" size="lg"
                    >
                        {t('cancel', 'Cancel')}
                    </Button>

                    <Button
                        onClick={() => {
                            if (parsedPositionId) {
                                void importPosition(parsedPositionId);
                            }
                        }}
                        disabled={isLoading || !parsedPositionId}
                        variant="default" size="lg"
                    >
                        {isLoading ? `Loading...` : `Import`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default SandboxImportModal;
