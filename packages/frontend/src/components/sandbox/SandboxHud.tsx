import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

import GameHudShell from '../game-screen/GameHudShell';
import { useTranslation } from 'react-i18next'

type SandboxHudProps = {
    positionName: string | null
    isAuthenticated: boolean
    occupiedCellCount: number
    renderableCellCount: number
    onResetBoard: () => void
    onUndo: () => void
    onRedo: () => void
    onResetView: () => void
    canUndo: boolean
    canRedo: boolean
    onSharePosition: () => void
    canSharePosition: boolean
    isSharingPosition: boolean
};

function SandboxHud({
    positionName,
    isAuthenticated,
    occupiedCellCount,
    renderableCellCount,
    onResetBoard, onUndo, onRedo,
    onResetView, canUndo, canRedo,
    onSharePosition,
    canSharePosition,
    isSharingPosition,
}: Readonly<SandboxHudProps>) {
    const { t } = useTranslation()
    const [isHudOpen, setIsHudOpen] = useState(true);
    const resetBoardLabel = positionName ? `Restore Position` : t('clearBoard', 'Clear Board');
    const description = positionName
        ? t('playFromThisSavedPositionLocallyWithNoClockAssignEitherSideToABotOrControlBothPlayersYourself', 'Play from this saved position locally with no clock. Assign either side to a bot or control both players yourself.')
        : t('localSandboxWithNoClockControlBothPlayersYourselfOrLetABotTakeEitherSide', 'Local sandbox with no clock. Control both players yourself or let a bot take either side.');

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === `ArrowLeft` && canUndo) {
                onUndo();
            } else if (event.key === `ArrowRight` && canRedo) {
                onRedo();
            }
        };

        window.addEventListener(`keydown`, handleKeyDown);
        return () => window.removeEventListener(`keydown`, handleKeyDown);
    }, [
        canUndo, canRedo, onUndo, onRedo,
    ]);

    return (
        <GameHudShell
            isOpen={isHudOpen}
            onOpen={() => setIsHudOpen(true)}
            onClose={() => setIsHudOpen(false)}

            openIcon={
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M5 8h14" />
                    <path d="M5 12h14" />
                    <path d="M5 16h14" />
                </svg>
            }

            role="left"

            openTitle="Open"
            closeTitle="Close"
        >
            <div className="pointer-events-auto absolute right-3 top-3 z-10">
                <Button
                    onClick={() => setIsHudOpen(false)}
                    aria-expanded={isHudOpen}
                    aria-label={t('closeSandboxHud', 'Close sandbox HUD')}
                    title={t('closeSandboxHud', 'Close sandbox HUD')}
                    variant="muted" size="icon"
                >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M6 6 18 18" />
                        <path d="M18 6 6 18" />
                    </svg>
                </Button>
            </div>

            <div className="text-sm uppercase tracking-[0.25em] text-emerald-300">
                {t('sandboxMode', 'Sandbox Mode')}
            </div>

            <h1 className="mt-1 text-2xl font-bold">
                {t('infiniteHexTictactoe', 'Infinite Hex Tic-Tac-Toe')}
            </h1>

            <div className="mt-2 text-sm text-slate-300">
                {description}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-1">
                <div className="border-l border-white/18 pl-3">
                    <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                        {t('cells', 'Cells')}
                    </div>

                    <div className="mt-1 text-white">
                        {renderableCellCount}
                        {` `}
                        active
                    </div>

                    <div className="text-slate-300">
                        {occupiedCellCount}
                        {` `}
                        occupied
                    </div>
                </div>

                <div className="border-l border-white/18 pl-3">
                    <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                        {positionName ? `Position` : `Mode`}
                    </div>

                    {positionName ? (
                        <>
                            <div className="mt-1 truncate text-white">
                                {positionName}
                            </div>

                            <div className="text-slate-300">
                                {t('sharedStartingPosition', 'Shared starting position')}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="mt-1 text-white">
                                {t('cleanBoard', 'Clean board')}
                            </div>

                            <div className="text-slate-300">
                                {t('localFreePlay2', 'Local free play')}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="pointer-events-auto mt-4 grid grid-cols-2 gap-2">
                <Button
                    variant="muted"
                    size="sm"
                    onClick={onResetView}
                    className="min-w-[9rem] flex-1 md:flex-none"
                >
                    {t('resetView', 'Reset View')}
                </Button>

                <Button
                    variant="muted"
                    size="sm"
                    onClick={onResetBoard}
                    className="min-w-[9rem] flex-1 md:flex-none"
                >
                    {resetBoardLabel}
                </Button>

                <Button
                    variant="muted"
                    size="sm"
                    onClick={onSharePosition}
                    disabled={!canSharePosition || isSharingPosition}
                    className="min-w-[9rem] flex-1 md:flex-none"
                >
                    {isSharingPosition ? `Sharing...` : `Share Link`}
                </Button>
            </div>

            <div className="pointer-events-auto mt-4 grid grid-cols-2 gap-2">
                <Button
                    variant="muted"
                    size="sm"
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="min-w-[9rem] flex-1 md:flex-none"
                >
                    {t('undo', 'Undo')}
                </Button>

                <Button
                    variant="muted"
                    size="sm"
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="min-w-[9rem] flex-1 md:flex-none"
                >
                    {t('redo', 'Redo')}
                </Button>
            </div>

            {!isAuthenticated && (
                <div className="w-full content-center mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-5 py-1 text-sm text-amber-100">
                    {t('signInToSharePositions', 'Sign in to share positions.')}
                </div>
            )}
        </GameHudShell>
    );
}

export default SandboxHud;
