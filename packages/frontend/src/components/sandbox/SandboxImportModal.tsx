import SandboxOverlay from './SandboxOverlay';
import { Button } from '@/components/ui/button';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SandboxGamePosition, SandboxPlayerSlot } from '@ih3t/shared';
import { Field, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { MAX_NOTATION_LENGTH, parseSandboxNotation, type SandboxImportPosition } from '../../sandbox/sandboxNotation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../query/queryDefinitions';
import { fetchSandboxPosition } from '../../query/sandboxClient';
import { extractSandboxPositionId } from '../../sandbox/sandboxPositionId';
import { useTranslation } from 'react-i18next'

type SandboxImportModalProps = {
    open: boolean
    onClose: () => void
    onImport: (position: SandboxImportPosition) => void
};

function SandboxImportModal({ open, onClose, onImport }: Readonly<SandboxImportModalProps>) {
    const { t } = useTranslation()
    const queryClient = useQueryClient();
    const inputId = useId();
    const [turnPlayer, setTurnPlayer] = useState<SandboxPlayerSlot | null>(null);
    const [turnPlacements, setTurnPlacements] = useState<number | null>(null);
    const [inputValue, setInputValue] = useState(``);
    const session = useRef(0);
    useEffect(() => {
        setInputValue(``);
        setTurnPlayer(null);
        setTurnPlacements(null);
        importMutation.reset();
        return () => { session.current += 1; };
    }, [open]);


    const importMutation = useMutation({
        mutationFn: async (position: SandboxGamePosition | string): Promise<SandboxImportPosition> => {
            if (typeof position !== `string`) {
                return {
                    id: null,
                    name: t('importedPosition', 'Imported Position'),
                    gamePosition: position,
                };
            }
            if (!position) throw new Error(`Enter a valid sandbox ID, link, or notation.`);
            return await queryClient.fetchQuery({
                queryKey: queryKeys.sandboxPosition(position),
                queryFn: () => fetchSandboxPosition(position),
                staleTime: 60 * 60 * 1000,
            });
        },
        onMutate: () => session.current,
        onSuccess: (response, _variables, currentSession) => {
            if (currentSession === session.current) onImport(response);
        },
    });

    const parsedPositionId = extractSandboxPositionId(inputValue);
    const parsedNotation = useMemo(() => {
        if (parsedPositionId || !inputValue.trim()) return { position: null, error: null };
        try {
            return { position: parseSandboxNotation(inputValue), error: null };
        } catch (error) {
            return { position: null, error: error instanceof Error ? error.message : `Invalid board notation.` };
        }
    }, [inputValue, parsedPositionId]);
    const visibleErrorMessage = parsedNotation.error ?? importMutation.error?.message;

    return (
        <SandboxOverlay open={open} label={t('importPosition', 'Import Position')} onClose={() => { if (!importMutation.isPending) onClose(); }}
            className="text-white w-full max-w-lg rounded-3xl border border-sky-300/20 bg-slate-900/95 px-6 py-6 shadow-[0_30px_120px_rgba(15,23,42,0.58)] backdrop-blur sm:px-8 sm:py-8">
                <h2 className="text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
                    {t('importPosition', 'Import Position')}
                </h2>

                <p className="mt-4 text-sm leading-6 text-slate-200 sm:text-base">
                    {t('pasteSandboxIdLinkOrNotation', 'Paste a sandbox ID or link, rectilinear or BKE notation, combined notation, HTTTX, or a Tyto analysis link.')}
                </p>

                <Field className="mt-6">
                    <FieldLabel htmlFor={inputId}>{t('position', 'Position')}</FieldLabel>
                    <Textarea
                        id={inputId}
                        value={inputValue}
                        onChange={(event) => {
                            setInputValue(event.target.value);
                            if (!importMutation.isPending) importMutation.reset();
                            setTurnPlayer(null);
                            setTurnPlacements(null);
                        }}
                        placeholder="abc1234, https://..., x-x/o.o//x, o A0 A1"
                        maxLength={MAX_NOTATION_LENGTH}
                        rows={5}
                        autoFocus
                        className="border-sky-300/15 bg-slate-950/80 text-slate-100"
                    />
                </Field>

                {parsedNotation.position && (
                    <div className="mt-4 space-y-3 text-sm text-slate-200">
                        <p>{t('notationImportsStonesOnly', 'Imports stones only; labels and highlights are omitted. Choose the next turn for this starting position.')}</p>
                        <div className="flex gap-3">
                            <Field>
                                <FieldLabel htmlFor={`${inputId}-player`}>{t('nextPlayer', 'Next Player')}</FieldLabel>
                                <select id={`${inputId}-player`} className="rounded-lg border border-sky-300/15 bg-slate-950 p-2"
                                    value={turnPlayer ?? parsedNotation.position.currentTurnPlayer}
                                    onChange={event => setTurnPlayer(event.target.value as SandboxPlayerSlot)}>
                                    <option value="player-1">{t('player1X', 'Player 1 (X)')}</option>
                                    <option value="player-2">{t('player2O', 'Player 2 (O)')}</option>
                                </select>
                            </Field>
                            <Field>
                                <FieldLabel htmlFor={`${inputId}-placements`}>{t('placementsRemaining', 'Placements Remaining')}</FieldLabel>
                                <select id={`${inputId}-placements`} className="rounded-lg border border-sky-300/15 bg-slate-950 p-2"
                                    value={turnPlacements ?? parsedNotation.position.placementsRemaining}
                                    onChange={event => setTurnPlacements(Number(event.target.value))}>
                                    <option value={1}>1</option>
                                    <option value={2}>2</option>
                                </select>
                            </Field>
                        </div>
                    </div>
                )}

                {visibleErrorMessage && (
                    <div className="mt-3 rounded-2xl border border-rose-600/60 bg-rose-500/10 px-4 py-3 text-left text-sm text-rose-600">
                        {visibleErrorMessage}
                    </div>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button
                        onClick={onClose}
                        disabled={importMutation.isPending}
                        variant="outline" size="lg"
                    >
                        {t('cancel', 'Cancel')}
                    </Button>

                    <Button
                        onClick={() => {
                            const position = parsedNotation.position ? {
                                ...parsedNotation.position,
                                currentTurnPlayer: turnPlayer ?? parsedNotation.position.currentTurnPlayer,
                                placementsRemaining: turnPlacements ?? parsedNotation.position.placementsRemaining,
                            } : parsedPositionId;
                            if (position) importMutation.mutate(position);
                        }}
                        disabled={importMutation.isPending || (!parsedPositionId && !parsedNotation.position)}
                        variant="default" size="lg"
                    >
                        {importMutation.isPending ? `Loading...` : `Import`}
                    </Button>
                </div>
        </SandboxOverlay>
    );
}

export default SandboxImportModal;
