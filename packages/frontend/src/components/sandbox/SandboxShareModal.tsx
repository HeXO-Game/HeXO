import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SandboxGamePosition, CreateSandboxPositionResponse } from '@ih3t/shared';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { createSandboxPosition } from '../../query/sandboxClient';
import { useTranslation } from 'react-i18next'

type SandboxShareModalProps = {
    open: boolean
    gamePosition: SandboxGamePosition | null
    initialName: string | null
    onClose: () => void
    onCreate: (position: CreateSandboxPositionResponse) => void
};

function SandboxShareModal({
    open,
    gamePosition,
    initialName,
    onClose,
    onCreate,
}: Readonly<SandboxShareModalProps>) {
    const { t } = useTranslation()
    const nameInputId = useId();
    const shareLinkInputId = useId();
    const [positionName, setPositionName] = useState(initialName ?? ``);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const session = useRef(0);
    const shareMutation = useMutation({
        mutationFn: async (name: string) => {
            if (!gamePosition) {
                throw new Error(`Only active sandbox positions can be shared.`);
            }
            return await createSandboxPosition(name, gamePosition);
        },
        onMutate: () => session.current,
        onSuccess: (response, _name, currentSession) => {
            if (currentSession !== session.current) return;
            setPositionName(response.name);
            setShareUrl(new URL(`/sandbox/${response.id}`, window.location.origin).toString());
            onCreate(response);
        },
    });

    useEffect(() => {
        setPositionName(initialName ?? ``);
        setShareUrl(null);
        shareMutation.reset();
        return () => { session.current += 1; };
    }, [open]);

    const copyShareUrl = async () => {
        if (!shareUrl) {
            return;
        }
        if (!navigator.clipboard?.writeText) {
            toast.error(`Clipboard access is not available in this browser.`);
            return;
        }

        try {
            await navigator.clipboard.writeText(shareUrl);
            toast.success(`Sandbox position link copied to clipboard.`);
        } catch {
            toast.error(`Failed to copy sandbox position link.`);
        }
    };

    const trimmedName = positionName.trim();
    const validationMessage = useMemo(() => {
        if (trimmedName.length === 0) {
            return t('enterANameForThisPosition', 'Enter a name for this position.');
        }

        if (trimmedName.length > 80) {
            return t('positionNamesCanBeAtMost80CharactersLong', 'Position names can be at most 80 characters long.');
        }

        return null;
    }, [t, trimmedName]);
    const visibleErrorMessage = shareMutation.error?.message ?? validationMessage;
    const isLinkReady = Boolean(shareUrl);

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
            <DialogContent showCloseButton={false} className="block max-h-[calc(100dvh-2rem)] overflow-y-auto text-white w-[calc(100%-2rem)] max-w-xl rounded-[1.5rem] border border-violet-300/20 bg-slate-900/95 px-6 py-6 shadow-[0_30px_120px_rgba(15,23,42,0.58)] backdrop-blur sm:px-8 sm:py-8">
                <DialogTitle className="mt-3 text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
                    {t('sharePosition', 'Share Position')}
                </DialogTitle>

                <DialogDescription className="mt-4 text-sm leading-6 text-slate-200 sm:text-base">
                    {isLinkReady
                        ? <>{t('sandboxLinkReady', 'Sandbox Link Ready')}. {t('anyoneWithThisLinkCanLoadTheCurrentSandboxPositionOntoTheirOwnBoard', 'Anyone with this link can load the current sandbox position onto their own board.')}</>
                        : t('giveThisSandboxPositionANameBeforeCreatingTheShareLink', 'Give this sandbox position a name before creating the share link.')}
                </DialogDescription>

                {!isLinkReady && (
                    <Field className="mt-6 text-left" data-invalid={Boolean(visibleErrorMessage)}>
                        <FieldLabel htmlFor={nameInputId}>
                            {t('positionName', 'Position Name')}
                        </FieldLabel>
                        <Input
                            aria-invalid={Boolean(visibleErrorMessage)}
                            id={nameInputId}
                            disabled={shareMutation.isPending}
                            value={positionName}
                            onChange={(event) => setPositionName(event.target.value)}
                            placeholder={t('openingTrapLadderTestEndgameStudy', 'Opening Trap, Ladder Test, Endgame Study...')}
                            autoFocus
                            className="h-auto w-full"
                        />
                    </Field>
                )}

                {isLinkReady && (
                    <>
                        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                {t('positionName', 'Position Name')}
                            </div>

                            <div className="mt-1 truncate text-sm text-white">
                                {trimmedName}
                            </div>
                        </div>

                        <Field className="mt-4 text-left">
                            <FieldLabel htmlFor={shareLinkInputId} className="sr-only">
                                {t('shareLink', 'Share Link')}
                            </FieldLabel>
                            <Input
                                id={shareLinkInputId}
                                value={shareUrl ?? ``}
                                readOnly
                                onFocus={(event) => event.currentTarget.select()}
                                className="h-auto w-full rounded-2xl border border-sky-300/15 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition placeholder:text-slate-500 focus:border-sky-300/40 focus:bg-slate-950 focus:ring-2 focus:ring-sky-300/12"
                            />
                        </Field>
                    </>
                )}

                {visibleErrorMessage && (
                    <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-400/8 px-4 py-3 text-left text-sm text-rose-100">
                        {visibleErrorMessage}
                    </div>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button
                        onClick={onClose}
                        variant="outline" size="lg"
                    >
                        {t('close', 'Close')}
                    </Button>

                    {isLinkReady ? (
                        <Button
                            onClick={() => void copyShareUrl()}
                            variant="violet" size="lg"
                        >
                            {t('copyLink', `Copy Link`)}
                        </Button>
                    ) : (
                        <Button
                            onClick={() => shareMutation.mutate(trimmedName)}
                            disabled={Boolean(validationMessage) || shareMutation.isPending}
                            variant="violet" size="lg"
                        >
                            {shareMutation.isPending ? `Creating...` : t('createLink', 'Create Link')}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default SandboxShareModal;
