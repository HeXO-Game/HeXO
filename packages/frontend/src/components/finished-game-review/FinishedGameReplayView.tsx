import { Button } from '@/components/ui/button';
import type { BoardTheme } from '@ih3t/board-renderer';
import {
    applyGameMove,
    type BoardState,
    type CellOccupant,
    createEmptyGameState,
    createStartedGameState,
    type FinishedGameRecord,
    type SandboxGamePosition,
} from '@ih3t/shared';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FlaskConical, House } from 'lucide-react';
import { useNavigate } from 'react-router';

import type { SandboxRouteInitialPosition, SandboxRouteState } from '../../routes/sandboxRouteState';
import GameBoardView from '../game-screen/GameBoardView';
import FinishedGameReviewLayout from './FinishedGameReviewLayout';
import FinishedGameSummary from './FinishedGameSummary';
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'

type FinishedGameReplayViewProps = {
    game: FinishedGameRecord
    theme: BoardTheme
    onRetry: () => void
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

function resolveReplayStartingPlayerId(game: FinishedGameRecord): string | null {
    const recordedFirstMovePlayerId = game.moves[0]?.playerId ?? null;
    if (recordedFirstMovePlayerId) {
        return recordedFirstMovePlayerId;
    }

    const hostPlayerId = game.players[0]?.playerId ?? null;
    const guestPlayerId = game.players[1]?.playerId ?? null;

    switch (game.gameOptions.firstPlayer) {
        case `host`:
            return hostPlayerId;
        case `guest`:
            return guestPlayerId ?? hostPlayerId;
        case `random`:
            return hostPlayerId;
    }
}

function buildReplayBoardState(game: FinishedGameRecord, visibleMoveCount: number): BoardState {
    const playerIds = game.players.map((player) => player.playerId);
    if (playerIds.length === 0) {
        return {
            ...createEmptyGameState(),
            playerTiles: game.playerTiles,
        };
    }

    const replayGameState = createStartedGameState(playerIds, resolveReplayStartingPlayerId(game));
    replayGameState.playerTiles = game.playerTiles;
    for (const move of game.moves.slice(0, visibleMoveCount)) {
        applyGameMove(replayGameState, {
            playerId: move.playerId as CellOccupant,
            x: move.x,
            y: move.y,
        });

        if (replayGameState.winner) {
            replayGameState.currentTurnPlayerId = null;
            replayGameState.placementsRemaining = 0;
            replayGameState.currentTurnExpiresInMs = null;
        }
    }

    return replayGameState;
}

function buildReplaySandboxPosition(game: FinishedGameRecord, visibleMoveCount: number): SandboxRouteInitialPosition | null {
    if (game.players.length < 2) {
        return null;
    }

    const visibleMoves = game.moves.slice(0, visibleMoveCount);
    const replayGameState = createStartedGameState(
        game.players.map((player) => player.playerId),
        resolveReplayStartingPlayerId(game),
    );

    for (const move of visibleMoves) {
        applyGameMove(replayGameState, move);
    }

    const placementsRemaining = Math.max(1, replayGameState.placementsRemaining);
    const gamePosition: SandboxGamePosition = {
        cells: visibleMoves.map((move, index) => ({
            x: move.x,
            y: move.y,
            player: move.playerId === game.players[0].playerId ? `player-1` : `player-2`,
            moveId: index + 1,
        })),
        currentTurnPlayer: replayGameState.currentTurnPlayerId === game.players[0].playerId ? `player-1` : `player-2`,
        placementsRemaining,
    };

    const moveLabel = visibleMoveCount === 0
        ? i18next.t('openingPosition', 'Opening Position')
        : i18next.t('replayMoveVisiblemovecountlength', 'Replay Move {{visibleMoveCount}}/{{length}}', { visibleMoveCount, length: game.moves.length });

    return {
        name: i18next.t('displaynameVsDisplayname2Movelabel', '{{displayName}} vs {{displayName2}} - {{moveLabel}}', { displayName: game.players[0].displayName, displayName2: game.players[1].displayName, moveLabel }),
        gamePosition,
    };
}

function FinishedGameReplayView({
    game,
    theme,
    onRetry,
}: Readonly<FinishedGameReplayViewProps>) {
    const { t } = useTranslation()
    const navigate = useNavigate();
    const [visibleMoveCount, setVisibleMoveCount] = useState(game.moves.length);
    const totalMoveCount = game.moves.length;

    useEffect(() => {
        setVisibleMoveCount(totalMoveCount);
    }, [game, totalMoveCount]);

    const goToPreviousMove = () => {
        setVisibleMoveCount((currentCount) => Math.max(0, currentCount - 1));
    };

    const goToNextMove = () => {
        setVisibleMoveCount((currentCount) => Math.min(totalMoveCount, currentCount + 1));
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }

            if (isEditableEventTarget(event.target)) {
                return;
            }

            if (event.key === `ArrowLeft`) {
                event.preventDefault();
                setVisibleMoveCount((currentCount) => Math.max(0, currentCount - 1));
            } else if (event.key === `ArrowRight`) {
                event.preventDefault();
                setVisibleMoveCount((currentCount) => Math.min(totalMoveCount, currentCount + 1));
            }
        };

        document.addEventListener(`keydown`, handleKeyDown);
        return () => document.removeEventListener(`keydown`, handleKeyDown);
    }, [totalMoveCount]);

    const boardState = useMemo(
        () => buildReplayBoardState(game, visibleMoveCount),
        [game, visibleMoveCount],
    );

    const activeMove = visibleMoveCount > 0
        ? game.moves[visibleMoveCount - 1]
        : null;
    const replaySandboxPosition = useMemo(
        () => buildReplaySandboxPosition(game, visibleMoveCount),
        [game, visibleMoveCount],
    );
    const highlightedCells = useMemo(
        () => activeMove ? [{ x: activeMove.x, y: activeMove.y }] : [],
        [activeMove],
    );

    return (
        <FinishedGameReviewLayout onRetry={onRetry}>
            <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_24rem]">
                <section className="min-h-[75dvh] flex min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/75 shadow-[0_20px_80px_rgba(15,23,42,0.45)] sm:rounded-4xl xl:min-h-136">
                    <GameBoardView
                        className="relative h-full min-h-0 overflow-hidden bg-slate-950 sm:max-h-none xl:min-h-0 xl:flex-1 xl:h-auto"
                        gameState={boardState}
                        highlightedCells={boardState.winner?.cells ?? highlightedCells}
                        localPlayerId={null}
                        interactionEnabled
                        theme={theme}
                    >
                        {({ resetView }) => (
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 p-3 sm:flex-nowrap sm:gap-4 sm:p-5">
                                <Button
                                    onClick={goToPreviousMove}
                                    disabled={visibleMoveCount === 0}
                                    aria-label={t('previousMove', 'Previous move')}
                                    variant="outline" size="icon-lg"
                                    className="pointer-events-auto bg-slate-950/95"
                                >
                                    <ChevronLeft aria-hidden="true" className="size-5" />
                                </Button>
                                <Button
                                    onClick={goToNextMove}
                                    disabled={visibleMoveCount >= totalMoveCount}
                                    aria-label={t('nextMove', 'Next move')}
                                    variant="outline" size="icon-lg"
                                    className="pointer-events-auto bg-slate-950/95"
                                >
                                    <ChevronRight aria-hidden="true" className="size-5" />
                                </Button>

                                <div className="pointer-events-auto order-first flex w-full min-w-0 items-center gap-4 rounded-xl border border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur sm:order-none sm:w-auto sm:flex-1">
                                    <span className="shrink-0 text-xs font-bold uppercase tracking-widest text-slate-200">
                                        {t('visiblemovecountLength', 'Move {{visibleMoveCount}} / {{length}}', { visibleMoveCount, length: totalMoveCount })}
                                    </span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={totalMoveCount}
                                        step={1}
                                        value={visibleMoveCount}
                                        disabled={totalMoveCount === 0}
                                        onChange={event => setVisibleMoveCount(Number(event.target.value))}
                                        aria-label={t('replayMoveVisiblemovecountlength', 'Replay Move {{visibleMoveCount}}/{{length}}', { visibleMoveCount, length: totalMoveCount })}
                                        className="h-6 min-w-0 flex-1 cursor-pointer accent-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300 disabled:cursor-default"
                                    />
                                </div>

                                <Button
                                    onClick={() => {
                                        if (replaySandboxPosition) {
                                            void navigate(`/sandbox`, {
                                                state: { initialPosition: replaySandboxPosition } satisfies SandboxRouteState,
                                            });
                                        }
                                    }}
                                    disabled={!replaySandboxPosition}
                                    aria-label={t('exploreInSandbox', 'Explore In Sandbox')}
                                    title={t('exploreInSandbox', 'Explore In Sandbox')}
                                    variant="outline" size="icon-lg"
                                    className="pointer-events-auto bg-slate-950/95"
                                >
                                    <FlaskConical aria-hidden="true" className="size-5" />
                                </Button>
                                <Button
                                    onClick={resetView}
                                    aria-label={t('resetView', 'Reset View')}
                                    title={t('resetView', 'Reset View')}
                                    variant="outline" size="icon-lg"
                                    className="pointer-events-auto bg-slate-950/95"
                                >
                                    <House aria-hidden="true" className="size-5" />
                                </Button>
                            </div>
                        )}
                    </GameBoardView>
                </section>

                <aside className="flex min-w-0 flex-col gap-4 xl:min-h-136 xl:overflow-hidden">
                    <FinishedGameSummary game={game} theme={theme} />
                </aside>
            </div>
        </FinishedGameReviewLayout>
    );
}

export default FinishedGameReplayView;
