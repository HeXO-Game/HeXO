import type { BoardState as RendererBoardState } from '@ih3t/board-renderer';
import type {
    DatabaseGamePlayer,
    GameState,
    PlayerNames,
    PlayerTileConfig,
} from '@ih3t/shared';

type PlayerReference = string | DatabaseGamePlayer;

export function toRendererBoardState(
    gameState: GameState,
    showTilePieceMarkers = false,
): RendererBoardState {
    const firstPlayerId = Object.keys(gameState.playerTiles)[0];
    return {
        placedCells: gameState.cells.map(cell => ({
            x: cell.x,
            y: cell.y,
            color: gameState.playerTiles[cell.occupiedBy]?.color ?? `#FF00FF`,
            marker: showTilePieceMarkers
                ? (cell.occupiedBy === firstPlayerId ? `X` : `O`)
                : undefined,
        })),
    };
}

export function getPlayerTileColor(
    playerTiles: Record<string, PlayerTileConfig> | null | undefined,
    playerId: string,
): string {
    return playerTiles?.[playerId]?.color ?? `#FF00FF`;
}

export function getPlayerLabel(
    players: readonly PlayerReference[],
    playerId: string | null,
    playerNames?: PlayerNames,
    fallbackName = `A player`,
): string {
    if (!playerId) {
        return fallbackName;
    }

    const databasePlayer = players.find(
        candidate => typeof candidate !== `string` && candidate.playerId === playerId,
    );
    if (databasePlayer && typeof databasePlayer !== `string`) {
        const displayName = databasePlayer.displayName.trim();
        if (displayName) {
            return displayName;
        }
    }

    const playerName = playerNames?.[playerId]?.trim();
    if (playerName) {
        return playerName;
    }

    const playerIndex = players.findIndex(
        player => (typeof player === `string` ? player : player.playerId) === playerId,
    );
    return playerIndex === -1 ? fallbackName : `Player ${playerIndex + 1}`;
}
