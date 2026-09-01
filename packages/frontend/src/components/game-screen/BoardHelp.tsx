import { Button } from '@/components/ui/button';
import { InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next'

type DisplayShortcuts = {
    showNthLastMoveShortcuts?: boolean
    showUndoRedoShortcuts?: boolean
};

function isEditableEventTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return target.isContentEditable
        || target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement;
}


function KeyboardIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="12" rx="2.5" />
            <path d="M7 10h.01M10 10h.01M13 10h.01M16 10h.01M7 14h6M16 14h.01" />
        </svg>
    );
}

function MouseIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="7" y="3" width="10" height="18" rx="5" />
            <path d="M12 3v6" />
        </svg>
    );
}

function ShortcutKey({
    children,
}: Readonly<{
    children: string
}>) {
    return (
        <span className="inline-flex items-center rounded-md border border-white/10 bg-white/7 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
            {children}
        </span>
    );
}

function ShortcutRow({
    label,
    description,
}: Readonly<{
    label: ReactNode
    description: string
}>) {
    return (
        <>
            <div className="flex flex-wrap gap-1.5 self-center">
                {label}
            </div>

            <div className="flex text-sm leading-6 text-slate-300 ">
                {description}
            </div>
        </>
    );
}

function ShortcutSection({
    title,
    icon,
    children,
}: Readonly<{
    title: string
    icon: ReactNode
    children: ReactNode
}>) {
    return (
        <section className="rounded-3xl border border-sky-300/10 bg-sky-300/6 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">
                {icon}
                {title}
            </div>

            <div className="mt-3 gap-y-3 gap-x-3 grid grid-cols-[fit-content(40%)_1fr]">
                {children}
            </div>
        </section>
    );
}

function BoardHelpOverlay({
    showNthLastMoveShortcuts,
    showUndoRedoShortcuts,
    onClose,
}: Readonly<DisplayShortcuts & {
    onClose: () => void
}>) {
    const { t } = useTranslation()
    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/76 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-label={t('boardHelp', 'Board help')}
                className="w-full max-w-4xl max-h-full rounded-[2rem] overflow-y-auto border border-white/10 bg-slate-950/96 p-5 text-white shadow-[0_30px_120px_rgba(2,6,23,0.7)] sm:p-6"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-200/75">
                            {t('boardHelp2', 'Board Help')}
                        </div>

                        <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                            {t('shortcutsAndMarkup', 'Shortcuts and markup')}
                        </h2>

                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                            {t('reviewRecentMovesMarkUpCandidateLinesAndNavigateTheBoardWithoutLeavingTheGame', 'Review recent moves, mark up candidate lines, and navigate the board without leaving the game.')}
                        </p>
                    </div>

                    <Button
                        type="button"
                        onClick={() => onClose()}
                        variant="outline" size="sm"
                    >
                        {t('close', 'Close')}
                    </Button>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <ShortcutSection title="Keyboard" icon={<KeyboardIcon />}>
                        {showNthLastMoveShortcuts && (
                            <ShortcutRow
                                label={(
                                    <ShortcutKey>
                                        1-9
                                    </ShortcutKey>
                                )}
                                description={t('showAndCenterTheNthLastMoveOnTheBoard', 'Show and center the nth last move on the board.')}
                            />
                        )}

                        {showUndoRedoShortcuts && (
                            <>
                                <ShortcutRow
                                    label={(
                                        <ShortcutKey>
                                            {t('arrowLeft', 'Arrow Left')}
                                        </ShortcutKey>
                                    )}
                                    description={t('undoTheLastMove', 'Undo the last move.')}
                                />

                                <ShortcutRow
                                    label={(
                                        <ShortcutKey>
                                            {t('arrowRight', 'Arrow Right')}
                                        </ShortcutKey>
                                    )}
                                    description={t('redoTheNextMove', 'Redo the next move.')}
                                />
                            </>
                        )}

                        <ShortcutRow
                            label={(
                                <>
                                    <ShortcutKey>
                                        ?
                                    </ShortcutKey>

                                    <ShortcutKey>
                                        {t('f1', 'F1')}
                                    </ShortcutKey>
                                </>
                            )}
                            description={t('openThisHelpCard', 'Open this help card.')}
                        />

                        <ShortcutRow
                            label={(
                                <ShortcutKey>
                                    {t('esc', 'Esc')}
                                </ShortcutKey>
                            )}
                            description={t('closeThisHelpCard', 'Close this help card.')}
                        />
                    </ShortcutSection>

                    <ShortcutSection title="Mouse" icon={<MouseIcon />}>
                        <ShortcutRow
                            label={(
                                <ShortcutKey>
                                    {t('rightDrag', 'Right Drag')}
                                </ShortcutKey>
                            )}
                            description={t('drawAMarkupLineOrMarkASingleCell', 'Draw a markup line or mark a single cell.')}
                        />

                        <ShortcutRow
                            label={(
                                <ShortcutKey>
                                    {t('rightClick', 'Right Click')}
                                </ShortcutKey>
                            )}
                            description={t('removeAnExistingMark', 'Remove an existing mark.')}
                        />

                        <ShortcutRow
                            label={(
                                <>
                                    <ShortcutKey>
                                        {t('shift', 'Shift')}
                                    </ShortcutKey>

                                    /

                                    <ShortcutKey>
                                        {t('ctrl', 'Ctrl')}
                                    </ShortcutKey>

                                    +

                                    <ShortcutKey>
                                        {t('rightDrag', 'Right Drag')}
                                    </ShortcutKey>
                                </>
                            )}
                            description={t('drawMarkupInYellow', 'Draw markup in yellow.')}
                        />

                        <ShortcutRow
                            label={(
                                <>
                                    <ShortcutKey>
                                        {t('alt', 'Alt')}
                                    </ShortcutKey>

                                    +

                                    <ShortcutKey>
                                        {t('rightDrag', 'Right Drag')}
                                    </ShortcutKey>
                                </>
                            )}
                            description={t('drawMarkupInBlue', 'Draw markup in blue.')}
                        />

                        <ShortcutRow
                            label={(
                                <>
                                    <ShortcutKey>
                                        {t('shift', 'Shift')}
                                    </ShortcutKey>

                                    +

                                    <ShortcutKey>
                                        {t('leftDrag', 'Left Drag')}
                                    </ShortcutKey>
                                </>
                            )}
                            description={t('startDrawingWithoutUsingTheRightMouseButton', 'Start drawing without using the right mouse button.')}
                        />
                    </ShortcutSection>
                </div>

                <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300">
                    {t('dragToPanUseTheMouseWheelOrPinchToZoomAndClickOrTapAnEmptyHexOnYourTurnToPlaceATile', 'Drag to pan, use the mouse wheel or pinch to zoom, and click or tap an empty hex on your turn to place a tile.')}
                </div>

                <div className="mt-5 flex justify-end">
                    <Button
                        type="button"
                        onClick={() => onClose()}
                        variant="default" size="default"
                    >
                        {t('continueGame', 'Continue Game')}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function HelpButton({
    onClick,
}: Readonly<{
    onClick: () => void
}>) {
    const { t } = useTranslation()
    return (
        <Button
            variant="ghost" size="icon" className="absolute bottom-2 left-2"
            title={t('boardHelp', 'Board help')}
            onClick={(event) => {
                onClick();
                event.currentTarget.blur();
            }}
        >
            <InfoIcon />
        </Button>
    );
}

function BoardHelp({
    showNthLastMoveShortcuts = false,
    showUndoRedoShortcuts = false,
}: Readonly<DisplayShortcuts>) {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.ctrlKey || event.metaKey || isEditableEventTarget(event.target)) {
                return;
            }

            if (event.key === `Escape`) {
                setIsOpen(false);
                return;
            }

            const shouldOpenHelp = event.key === `?` || event.key === `F1`;
            if (!shouldOpenHelp) {
                return;
            }

            event.preventDefault();
            setIsOpen(true);
        };

        document.addEventListener(`keydown`, handleKeyDown);
        return () => document.removeEventListener(`keydown`, handleKeyDown);
    }, []);

    return (
        <>
            {isOpen && (
                <BoardHelpOverlay
                    showNthLastMoveShortcuts={showNthLastMoveShortcuts}
                    showUndoRedoShortcuts={showUndoRedoShortcuts}
                    onClose={() => setIsOpen(false)}
                />
            )}

            <HelpButton onClick={() => setIsOpen(true)} />
        </>
    );
}

export default BoardHelp;
