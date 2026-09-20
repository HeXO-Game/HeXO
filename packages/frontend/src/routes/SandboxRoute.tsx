import { BoardController } from '@ih3t/board-renderer';
import {
    applyGameMove,
    cloneGameState,
    createStartedGameState,
    type Game,
    GameRuleError,
    type GameState,
    type HexCoordinate,
    type SandboxGamePosition,
    type SandboxPlayerSlot,
    type SandboxPositionResponse,
    type CreateSandboxPositionResponse,
    type SessionPlayer,
} from '@ih3t/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'react-toastify';

import GameBoardView from '../components/game-screen/GameBoardView';
import PageMetadata, { DEFAULT_PAGE_TITLE, type PageMetadataProps } from '../components/PageMetadata';
import SandboxBotFactoryModal from '../components/sandbox/SandboxBotFactoryModal';
import SandboxBotPanel from '../components/sandbox/SandboxBotPanel';
import SandboxHud from '../components/sandbox/SandboxHud';
import SandboxPlacementPanel from '../components/sandbox/SandboxPlacementPanel';
import SandboxBoardPanel from '../components/sandbox/SandboxBoardPanel';
import SandboxPositionPanel from '../components/sandbox/SandboxPositionPanel';
import SandboxImportModal from '../components/sandbox/SandboxImportModal';
import SandboxShareModal from '../components/sandbox/SandboxShareModal';
import SandboxTurnIndicator from '../components/sandbox/SandboxTurnIndicator';
import SandboxWelcomeModal from '../components/sandbox/SandboxWelcomeModal';
import SandboxWinnerBanner from '../components/sandbox/SandboxWinnerBanner';
import { useQueryAccount, useQueryAccountPreferences } from '../query/accountClient';
import { useQuerySandboxPosition } from '../query/sandboxClient';
import { kSandboxBotEngines, SandboxBotEngineInfo } from '../sandbox/botLoader';
import {
    createDefaultSandboxPlayerModes,
    persistSandboxBotTimeoutMs,
    readSandboxBotTimeoutMs,
    sanitizeSandboxBotTimeoutMs,
} from '../sandbox/sandboxBotSettings';
import { type SandboxImportPosition } from '../sandbox/sandboxNotation';
import { editSandboxCell, type SandboxPlacementMode } from '../sandbox/sandboxPlacement';
import { restoreSandboxPosition } from '../sandbox/sandboxPosition';
import { normalizeSandboxPositionId } from '../sandbox/sandboxPositionId';
import { useSandboxBotController } from '../sandbox/useSandboxBotController';
import { playTilePlacedSound } from '../soundEffects';
import { getBoardTheme } from '../utils/gameBoard';
import { formatPlacementSummary, formatSandboxPlayerLabel } from '../utils/routeMetadata';
import type { SandboxRouteState } from './sandboxRouteState';
import BoardHelp from "../components/game-screen/BoardHelp.tsx";
import { useTranslation } from 'react-i18next'
import { cn } from 'cn';

type SandboxSnapshot = {
    positionName: string | null
    gameState: GameState
    gameHistory: GameState[]
};

const kSandboxSessionPlayers: SessionPlayer[] = [
    {
        id: `sandbox-player-1`,
        displayName: `Player 1`,
        profileId: null,
        isBot: false,
        rating: { eloScore: 0, gameCount: 0 },
        ratingAdjustment: null,
        connection: { status: `connected` },
    },
    {
        id: `sandbox-player-2`,
        displayName: `Player 2`,
        profileId: null,
        isBot: false,
        rating: { eloScore: 0, gameCount: 0 },
        ratingAdjustment: null,
        connection: { status: `connected` },
    },
];

function createSandboxGameState() {
    return createStartedGameState(
        kSandboxSessionPlayers.map(player => player.id),
        kSandboxSessionPlayers[0].id
    );
}

function getSandboxPlayerSlot(playerId: string): SandboxPlayerSlot {
    return playerId === kSandboxSessionPlayers[0].id ? `player-1` : `player-2`;
}

function buildSandboxGamePosition(gameState: GameState, initialCellCount = 0): SandboxGamePosition | null {
    if (!gameState.currentTurnPlayerId || gameState.placementsRemaining < 1) {
        return null;
    }

    return {
        ...(initialCellCount > 0 ? { initialCellCount } : {}),
        cells: gameState.cells.map((cell, index) => ({
            x: cell.x,
            y: cell.y,
            player: getSandboxPlayerSlot(cell.occupiedBy),
            moveId: index + 1,
        })),
        currentTurnPlayer: getSandboxPlayerSlot(gameState.currentTurnPlayerId),
        placementsRemaining: gameState.placementsRemaining,
    };
}

function getSandboxPositionKey(gameState: GameState) {
    const gamePosition = buildSandboxGamePosition(gameState);
    return gamePosition ? JSON.stringify(gamePosition) : null;
}

function createSandboxSnapshot(gameState: GameState, gameHistory: readonly GameState[], positionName: string | null): SandboxSnapshot {
    return {
        positionName,
        gameState: cloneGameState(gameState),
        gameHistory: gameHistory.map((entry) => cloneGameState(entry)),
    };
}

const kEmptyGameHistory = [createSandboxGameState()] as const;
const kCleanBoardState = createSandboxGameState();

function SandboxRoute() {
    const { t } = useTranslation()
    const location = useLocation();
    const navigate = useNavigate();
    const { data: account } = useQueryAccount({ enabled: true });
    const { data: accountPreferences } = useQueryAccountPreferences({ enabled: account?.user !== null });

    const { positionId: routePositionId } = useParams<{ positionId?: string }>();

    const [game, setGame] = useState<Game>({ history: [...kEmptyGameHistory], currentStateIndex: 0 });
    const currentGameState = game.history[game.currentStateIndex];

    const setGameHistory = (gameHistory: readonly GameState[]) => setGame({
        history: [...gameHistory], currentStateIndex: gameHistory.length - 1,
    });
    const resetGame = () => setGame({ history: [...kEmptyGameHistory], currentStateIndex: 0 });

    const [loadedSnapshot, setLoadedSnapshot] = useState<SandboxSnapshot | null>(null);
    const [isWelcomeModalVisible, setIsWelcomeModalVisible] = useState(true);
    const [isWinnerBannerVisible, setIsWinnerBannerVisible] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isImportingPosition, setIsImportingPosition] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [botPlayerModes, setBotPlayerModes] = useState(() => createDefaultSandboxPlayerModes());
    const [botTimeoutMs, setBotTimeoutMs] = useState(() => readSandboxBotTimeoutMs());
    const [selectedBotEngine, setSelectedBotEngine] = useState<SandboxBotEngineInfo | null>(null);
    const [placementMode, setPlacementMode] = useState<SandboxPlacementMode>('turn');
    const [hasBoardEdits, setHasBoardEdits] = useState(false);
    const [isBotFactoryModalOpen, setIsBotFactoryModalOpen] = useState(false);
    const previousCellCountRef = useRef(currentGameState.cells.length);
    const lastLoadedPositionIdRef = useRef<string | null>(null);
    const lastInvalidRoutePositionIdRef = useRef<string | null>(null);
    const lastAppliedLocationKeyRef = useRef<string | null>(null);
    const normalizedRoutePositionId = normalizeSandboxPositionId(routePositionId);
    const routeState = location.state as SandboxRouteState | null;
    const routeInitialPosition = routeState?.initialPosition ?? null;
    const routeBotGame = routeState?.botGame ?? null;

    const initialBoardState = loadedSnapshot?.gameState ?? kCleanBoardState;
    const initialBoardStateKey = getSandboxPositionKey(initialBoardState);
    const currentBoardStateKey = getSandboxPositionKey(currentGameState);
    const currentPositionName = loadedSnapshot?.positionName ?? null;
    const isAuthenticated = Boolean(account !== null);
    const currentTurnPlayerSlot = currentGameState.currentTurnPlayerId ? getSandboxPlayerSlot(currentGameState.currentTurnPlayerId)
        : null;
    const isCurrentTurnBotControlled = currentTurnPlayerSlot
        ? botPlayerModes[currentTurnPlayerSlot] === `bot`
        : false;
    const localPlayerId = currentGameState.winner === null && !isCurrentTurnBotControlled ? (currentGameState.currentTurnPlayerId ?? kSandboxSessionPlayers[0].id)
        : null;
    const canUndo = game.currentStateIndex > 0;
    const canRedo = game.currentStateIndex !== game.history.length - 1;
    const canSharePosition = isAuthenticated && currentGameState.winner === null
        && currentBoardStateKey !== null
        && currentBoardStateKey !== initialBoardStateKey;
    const routeSandboxPositionQuery = useQuerySandboxPosition(normalizedRoutePositionId, {
        enabled: Boolean(normalizedRoutePositionId),
    });
    const isRoutePositionLoading
        = Boolean(normalizedRoutePositionId)
        && routeSandboxPositionQuery.isFetching
        && lastLoadedPositionIdRef.current !== normalizedRoutePositionId;
    const botPlayerIds = kSandboxSessionPlayers
        .filter((player) => botPlayerModes[getSandboxPlayerSlot(player.id)] === `bot`)
        .map((player) => player.id);
    const isSandboxInteractionEnabled
        = !isWelcomeModalVisible
        && !isWinnerBannerVisible
        && !isImportModalOpen
        && !isImportingPosition
        && !isShareModalOpen
        && !isBotFactoryModalOpen
        && !isRoutePositionLoading;
    const isBotPlaybackEnabled
        = placementMode === 'turn'
        && !isWelcomeModalVisible
        && !isImportModalOpen
        && !isImportingPosition
        && !isShareModalOpen
        && !isBotFactoryModalOpen
        && !isRoutePositionLoading;

    const sandboxBotController = useSandboxBotController({
        gameState: currentGameState,
        botTurnEnabled: isBotPlaybackEnabled,
        botFactory: selectedBotEngine,
        playerModes: botPlayerModes,
        timeoutMs: botTimeoutMs,
        resolvePlayerSlot: getSandboxPlayerSlot,
        onApplyBotMoves: applyBotMoves,
        onBotError: (message) => {
            toast.error(message, {
                toastId: `sandbox-bot:${message}`,
            });
        },
    });
    const isBotBusy = sandboxBotController.isThinking;

    const boardController = useMemo(() => new BoardController(), []);
    function applyBotMoves(moves: readonly HexCoordinate[]) {
        if (moves.length === 0) {
            return;
        }

        const currentGameHistory = game.history.slice(0, game.currentStateIndex + 1);
        const nextGameState = cloneGameState(currentGameState);
        const nextGameHistory = [...currentGameHistory];

        for (const move of moves) {
            const actingPlayerId = nextGameState.currentTurnPlayerId;
            if (!actingPlayerId || nextGameState.winner) {
                break;
            }

            try {
                applyGameMove(nextGameState, {
                    playerId: actingPlayerId,
                    x: move.x,
                    y: move.y,
                });
                nextGameHistory.push(cloneGameState(nextGameState));

            } catch (error) {
                const errorMessage = error instanceof GameRuleError
                    ? error.message
                    : t('thisMoveIsNotLegalInSandboxMode', 'This move is not legal in sandbox mode.');
                toast.error(errorMessage, {
                    toastId: `sandbox:${errorMessage}`,
                });
                break;
            }
        }

        if (nextGameHistory.length === currentGameHistory.length) {
            return;
        }

        setGameHistory(nextGameHistory);
        setIsWinnerBannerVisible(Boolean(nextGameState.winner));
    }

    function applySandboxPosition(
        positionName: string,
        gamePosition: SandboxGamePosition,
        positionId: string | null,
        isNotation = false,
    ) {
        const { gameState: nextGameState, gameHistory: nextGameHistory } = restoreSandboxPosition(
            isNotation ? { ...gamePosition, initialCellCount: gamePosition.cells.length } : gamePosition,
            [kSandboxSessionPlayers[0].id, kSandboxSessionPlayers[1].id],
        );
        const nextLoadedSnapshot = createSandboxSnapshot(nextGameState, nextGameHistory, positionName);

        previousCellCountRef.current = nextGameState.cells.length;
        lastLoadedPositionIdRef.current = positionId;
        lastInvalidRoutePositionIdRef.current = null;

        setPlacementMode('turn');
        setHasBoardEdits(false);
        setLoadedSnapshot(nextLoadedSnapshot);
        setGameHistory(nextGameHistory);
        setIsBotFactoryModalOpen(false);
        setIsWinnerBannerVisible(false);
        setIsImportModalOpen(false);
        setIsShareModalOpen(false);
        boardController.resetView();
    }

    function applyLoadedSandboxPosition(response: SandboxPositionResponse) {
        applySandboxPosition(response.name, response.gamePosition, response.id);
    }

    function handlePlaceCell(x: number, y: number) {
        if (placementMode !== 'turn') {
            const nextState = editSandboxCell(currentGameState, placementMode, x, y,
                [kSandboxSessionPlayers[0].id, kSandboxSessionPlayers[1].id]);
            setGameHistory([...game.history.slice(0, game.currentStateIndex + 1), nextState]);
            setHasBoardEdits(true);
            setIsWinnerBannerVisible(false);
            return;
        }
        const actingPlayerId = currentGameState.currentTurnPlayerId ?? kSandboxSessionPlayers[0].id;
        const nextGameState = cloneGameState(currentGameState);

        try {
            applyGameMove(nextGameState, {
                playerId: actingPlayerId,
                x,
                y,
            });

            const nextGameHistory = [...game.history.slice(0, game.currentStateIndex + 1), nextGameState];
            setGameHistory(nextGameHistory);
            setIsWinnerBannerVisible(Boolean(nextGameState.winner));
        } catch (error) {
            const errorMessage = error instanceof GameRuleError
                ? error.message
                : t('thisMoveIsNotLegalInSandboxMode', 'This move is not legal in sandbox mode.');
            toast.error(errorMessage, {
                toastId: `sandbox:${errorMessage}`,
            });
        }
    }

    useEffect(() => {
        const previousCellCount = previousCellCountRef.current;
        if (currentGameState.cells.length > previousCellCount) {
            playTilePlacedSound();
        }

        previousCellCountRef.current = currentGameState.cells.length;
    }, [currentGameState]);

    useEffect(() => {
        persistSandboxBotTimeoutMs(botTimeoutMs);
    }, [botTimeoutMs]);

    useEffect(() => {
        if (!routePositionId) {
            if (!routeInitialPosition) {
                setLoadedSnapshot(null);
            }
            setIsImportingPosition(false);
            lastLoadedPositionIdRef.current = null;
            lastInvalidRoutePositionIdRef.current = null;
            return;
        }

        if (!normalizedRoutePositionId) {
            if (lastInvalidRoutePositionIdRef.current !== routePositionId) {
                lastInvalidRoutePositionIdRef.current = routePositionId;
                toast.error(`Sandbox position id is invalid.`);
            }
            setIsImportingPosition(false);
            void navigate(`/sandbox`, { replace: true });
            return;
        }

        if (lastLoadedPositionIdRef.current === normalizedRoutePositionId) {
            setIsImportingPosition(false);
            setIsWelcomeModalVisible(false);
            return;
        }

        setIsImportingPosition(true);
        setIsWelcomeModalVisible(false);
    }, [
        navigate, normalizedRoutePositionId, routeInitialPosition, routePositionId,
    ]);

    useEffect(() => {
        if (routePositionId || !routeInitialPosition) {
            return;
        }

        if (lastAppliedLocationKeyRef.current === location.key) {
            return;
        }

        lastAppliedLocationKeyRef.current = location.key;
        applySandboxPosition(routeInitialPosition.name, routeInitialPosition.gamePosition, null, routeInitialPosition.isNotation);
        setIsWelcomeModalVisible(false);
    }, [
        location.key, routeInitialPosition, routePositionId,
    ]);

    useEffect(() => {
        if (routePositionId || routeInitialPosition || !routeBotGame) {
            return;
        }

        if (lastAppliedLocationKeyRef.current === location.key) {
            return;
        }

        lastAppliedLocationKeyRef.current = location.key;
        lastLoadedPositionIdRef.current = null;
        lastInvalidRoutePositionIdRef.current = null;
        setLoadedSnapshot(null);
        setBotPlayerModes({
            'player-1': routeBotGame.botPlayerSlot === `player-1` ? `bot` : `human`,
            'player-2': routeBotGame.botPlayerSlot === `player-2` ? `bot` : `human`,
        });
        setSelectedBotEngine(
            kSandboxBotEngines.find((engine) => engine.name === routeBotGame.engineName)
            ?? kSandboxBotEngines[0]
            ?? null,
        );
        setIsWelcomeModalVisible(false);
        setIsBotFactoryModalOpen(false);
        setIsWinnerBannerVisible(false);
        setIsImportModalOpen(false);
        setIsShareModalOpen(false);

        const nextGameState = createSandboxGameState();
        previousCellCountRef.current = nextGameState.cells.length;
        resetGame();
        boardController.resetView();
    }, [
        location.key, boardController, routeBotGame, routeInitialPosition, routePositionId,
    ]);

    useEffect(() => {
        if (!normalizedRoutePositionId) {
            return;
        }

        if (!routeSandboxPositionQuery.data) {
            return;
        }

        if (lastLoadedPositionIdRef.current === normalizedRoutePositionId) {
            return;
        }

        applyLoadedSandboxPosition(routeSandboxPositionQuery.data);
        setIsImportingPosition(false);
    }, [normalizedRoutePositionId, routeSandboxPositionQuery.data]);

    useEffect(() => {
        if (!normalizedRoutePositionId) {
            return;
        }

        if (!routeSandboxPositionQuery.error) {
            return;
        }

        if (lastLoadedPositionIdRef.current === normalizedRoutePositionId) {
            return;
        }

        toast.error(routeSandboxPositionQuery.error instanceof Error ? routeSandboxPositionQuery.error.message : `Failed to load sandbox position.`);
        lastLoadedPositionIdRef.current = null;
        setIsImportingPosition(false);
        void navigate(`/sandbox`, { replace: true });
    }, [
        navigate, normalizedRoutePositionId, routeSandboxPositionQuery.error,
    ]);

    const resetSandbox = (clearPosition = false) => {
        if (clearPosition && !loadedSnapshot) return;
        setHasBoardEdits(false);
        const nextGameState = !clearPosition && loadedSnapshot
            ? cloneGameState(loadedSnapshot.gameState)
            : createSandboxGameState();
        const nextGameHistory = !clearPosition && loadedSnapshot
            ? loadedSnapshot.gameHistory.map((entry) => cloneGameState(entry))
            : kEmptyGameHistory;

        previousCellCountRef.current = nextGameState.cells.length;
        setGameHistory(nextGameHistory);
        setIsBotFactoryModalOpen(false);
        setIsWinnerBannerVisible(false);
        setIsShareModalOpen(false);
        if (clearPosition) {
            setLoadedSnapshot(null);
            lastLoadedPositionIdRef.current = null;
            setIsImportingPosition(false);
            setIsImportModalOpen(false);
            void navigate('/sandbox', { replace: true, state: null });
        }
    };

    const undoMove = () => {
        const previousGameState = game.history[game.currentStateIndex - 1];
        if (!previousGameState) {
            return;
        }

        previousCellCountRef.current = previousGameState.cells.length;
        setGame({ ...game, currentStateIndex: game.currentStateIndex - 1 });
        setIsWinnerBannerVisible(false);
        closeShareModal();
    };

    const redoMove = () => {
        const nextGameState = game.history[game.currentStateIndex + 1];
        if (!nextGameState) {
            return;
        }

        previousCellCountRef.current = nextGameState.cells.length;
        setGame({ ...game, currentStateIndex: game.currentStateIndex + 1 });
        closeShareModal();
    };

    useEffect(() => {
        if (isWelcomeModalVisible || isImportModalOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.target instanceof HTMLElement &&
                (event.target.closest('input, textarea, select, [role="dialog"], [data-slot="accordion-trigger"]') || event.target.isContentEditable)) return;
            if (event.key === 'ArrowLeft' && canUndo) undoMove();
            else if (event.key === 'ArrowRight' && canRedo) redoMove();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canUndo, canRedo, undoMove, redoMove, isWelcomeModalVisible, isImportModalOpen]);

    const handlePositionShared = (response: CreateSandboxPositionResponse) => {
        setLoadedSnapshot(createSandboxSnapshot(currentGameState, game.history, response.name));
        lastLoadedPositionIdRef.current = response.id;
        if (routePositionId !== response.id) {
            void navigate(`/sandbox/${response.id}`, { replace: true });
        }
    };

    const handlePositionImported = (response: SandboxImportPosition) => {
        if (response.id === null) {
            void navigate(`/sandbox`, {
                state: { initialPosition: { name: response.name, gamePosition: response.gamePosition, isNotation: true } } satisfies SandboxRouteState,
            });
            return;
        }
        applySandboxPosition(response.name, response.gamePosition, response.id);
        setIsWelcomeModalVisible(false);
        if (routePositionId !== response.id) {
            void navigate(`/sandbox/${response.id}`);
        }
    };

    const closeShareModal = () => {
        setIsShareModalOpen(false);
    };

    const handleSelectBotEngine = (engine: SandboxBotEngineInfo | null) => {
        setSelectedBotEngine(engine);
        if (engine === null) {
            setBotPlayerModes(createDefaultSandboxPlayerModes());
        }
        setIsBotFactoryModalOpen(false);
    };

    const handleBotPlayerModeChange = (playerSlot: SandboxPlayerSlot, nextMode: `human` | `bot`) => {
        setBotPlayerModes((currentModes) => ({
            ...currentModes,
            [playerSlot]: nextMode,
        }));
    };

    const handleBotTimeoutMsChange = (nextTimeoutMs: number) => {
        setBotTimeoutMs(sanitizeSandboxBotTimeoutMs(nextTimeoutMs));
    };

    let pageMetadata: Partial<PageMetadataProps>;
    if (routeSandboxPositionQuery.data) {
        pageMetadata = {
            title: t('nameSandboxModeDefault_page_title', '{{name}} • Sandbox Mode • {{DEFAULT_PAGE_TITLE}}', { name: routeSandboxPositionQuery.data.name, DEFAULT_PAGE_TITLE }),
            description: t('openTheNameSandboxPositionWithLengthPlacedValVal2ToMoveWithVal3', 'Open the "{{name}}" sandbox position with {{length}} placed {{val}}. {{val2}} to move with {{val3}}.', { name: routeSandboxPositionQuery.data.name, length: routeSandboxPositionQuery.data.gamePosition.cells.length, val: routeSandboxPositionQuery.data.gamePosition.cells.length === 1 ? `cell` : `cells`, val2: formatSandboxPlayerLabel(routeSandboxPositionQuery.data.gamePosition.currentTurnPlayer), val3: formatPlacementSummary(routeSandboxPositionQuery.data.gamePosition.placementsRemaining) }),
            ogType: `article`,
        };
    } else if (normalizedRoutePositionId && routeSandboxPositionQuery.error) {
        pageMetadata = {
            title: t('sandboxPositionNotFoundDefault_page_title', 'Sandbox Position Not Found • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE }),
            description: t('theRequestedSandboxPositionCouldNotBeFoundOpenSandboxModeToStartFromACleanBoardOrImportAnotherSharedPosition', 'The requested sandbox position could not be found. Open sandbox mode to start from a clean board or import another shared position.'),
            ogType: `article`,
            robots: 'noindex, nofollow',
        };
    } else {
        pageMetadata = {
            title: t('sandboxModeDefault_page_title', 'Sandbox Mode • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE }),
            description: t('playHexoLocallyWithNoClockControlBothSidesImportSharedPositionsAndExploreCustomBoards', 'Play HeXO locally with no clock, control both sides, import shared positions, and explore custom boards.'),
        };
    }

    return (
        <>
            <PageMetadata {...pageMetadata} />

            <div className="relative h-full w-full overflow-hidden text-white">
                <GameBoardView
                    gameState={currentGameState}
                    highlightedCells={currentGameState.winner?.cells ?? `turn`}
                    localPlayerId={localPlayerId}

                    interactionEnabled={isSandboxInteractionEnabled}

                    editCells={placementMode !== 'turn'}
                    onPlaceCell={placementMode !== 'turn' || currentGameState.winner === null ? handlePlaceCell : undefined}
                    theme={getBoardTheme(accountPreferences?.preferences.boardTheme)}
                    controller={boardController}
                />

                <BoardHelp showUndoRedoShortcuts={true} />

                <div className="pointer-events-none absolute inset-0">
                    <div className="flex h-full flex-col justify-between gap-4">
                        <SandboxTurnIndicator
                            theme={getBoardTheme(accountPreferences?.preferences.boardTheme)}
                            players={kSandboxSessionPlayers.map(player => ({
                                ...player,
                                displayName: botPlayerIds.includes(player.id) ? t('botAsDisplayname', 'Bot as {{displayName}}', { displayName: player.displayName }) : player.displayName,
                            }))}
                            botPlayerIds={botPlayerIds}
                            gameState={currentGameState}
                            winnerId={currentGameState.winner?.playerId ?? null}
                            isBotThinking={isBotBusy}

                            className={cn(
                                isWelcomeModalVisible && "hidden"
                            )}
                        />

                        <SandboxWinnerBanner
                            theme={getBoardTheme(accountPreferences?.preferences.boardTheme)}
                            players={kSandboxSessionPlayers}
                            gameState={currentGameState}
                            winnerId={isWinnerBannerVisible ? currentGameState.winner?.playerId ?? null : null}
                            onResetBoard={() => resetSandbox()}
                            onExploreBoard={() => setIsWinnerBannerVisible(false)}
                            className={cn(
                                isWelcomeModalVisible && "hidden"
                            )}
                        />

                        <SandboxWelcomeModal
                            open={isWelcomeModalVisible}
                            onStartCleanBoard={() => setIsWelcomeModalVisible(false)}
                            onImportPosition={() => setIsImportModalOpen(true)}
                        />

                        <SandboxImportModal
                            open={isImportModalOpen}
                            onClose={() => setIsImportModalOpen(false)}
                            onImport={handlePositionImported}
                        />

                        <SandboxShareModal
                            open={isShareModalOpen}
                            gamePosition={buildSandboxGamePosition(currentGameState, hasBoardEdits ? currentGameState.cells.length : game.history[0].cells.length)}
                            initialName={currentPositionName}
                            originalPositionId={loadedSnapshot ? lastLoadedPositionIdRef.current : null}
                            onClose={closeShareModal}
                            onCreate={handlePositionShared}
                        />

                        <SandboxBotFactoryModal
                            open={isBotFactoryModalOpen}
                            onClose={() => setIsBotFactoryModalOpen(false)}
                            selectedEngine={selectedBotEngine?.name ?? null}
                            onSelectBotFactory={handleSelectBotEngine}
                        />

                        {!isWelcomeModalVisible && (
                            <div className="absolute inset-0 flex flex-col justify-end pointer-events-none">
                                <SandboxHud
                                    positionName={loadedSnapshot?.positionName ?? null}
                                    placementPanel={
                                        <SandboxPlacementPanel
                                            placementMode={placementMode}
                                            onPlacementModeChange={(mode) => { setPlacementMode(mode); setIsWinnerBannerVisible(false); }}
                                        />
                                    }
                                    boardPanel={
                                        <SandboxBoardPanel
                                            onResetBoard={() => resetSandbox()}
                                            onUndo={undoMove}
                                            onRedo={redoMove}
                                            onResetView={() => boardController.resetView()}
                                            canUndo={canUndo}
                                            canRedo={canRedo}
                                        />
                                    }
                                    positionPanel={
                                        <SandboxPositionPanel
                                            hasPosition={loadedSnapshot !== null}
                                            onImportPosition={() => setIsImportModalOpen(true)}
                                            onResetPosition={() => resetSandbox(true)}
                                            onSharePosition={() => setIsShareModalOpen(true)}
                                            canSharePosition={canSharePosition && !isShareModalOpen}
                                        />
                                    }
                                    botPanel={
                                        <SandboxBotPanel

                                            selectedFactory={selectedBotEngine ?? null}

                                            botDisplayName={sandboxBotController.botDisplayName}
                                            botCapabilities={sandboxBotController.botCapabilities}
                                            botAvailabilityMessage={sandboxBotController.botAvailabilityMessage}
                                            botErrorMessage={sandboxBotController.lastErrorMessage}

                                            botPlayerModes={botPlayerModes}
                                            currentTurnPlayerSlot={currentTurnPlayerSlot}
                                            botTimeoutMs={botTimeoutMs}
                                            isBotThinking={isBotBusy}
                                            isCurrentTurnBotControlled={isCurrentTurnBotControlled}
                                            onChangeBotEngine={() => setIsBotFactoryModalOpen(true)}
                                            onBotPlayerModeChange={handleBotPlayerModeChange}
                                            onBotTimeoutMsChange={handleBotTimeoutMsChange}
                                        />
                                    }
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default SandboxRoute;
