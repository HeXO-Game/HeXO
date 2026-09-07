import { createStartedGameState, findWinningLine, getCompletedTurnCount, zCellOccupant, type SandboxGamePosition, type SandboxPlayerSlot } from '@ih3t/shared';
import { parseNotation } from './notation/parseNotation';

export { MAX_NOTATION_LENGTH } from './notation/notationResult';

export type SandboxImportPosition = {
    id: string | null
    name: string
    gamePosition: SandboxGamePosition
};

export function parseSandboxNotation(input: string): SandboxGamePosition {
    const result = parseNotation(input);
    return {
        cells: result.cells.map((cell, index) => ({
            x: cell.x,
            y: cell.y,
            player: cell.player === 'x' ? 'player-1' : 'player-2',
            moveId: index + 1,
        })),
        currentTurnPlayer: result.currentTurnPlayer === 'x' ? 'player-1' : 'player-2',
        placementsRemaining: result.placementsRemaining,
    };
}

export function createNotationGameState(position: SandboxGamePosition, playerIds: readonly [string, string]) {
    const playerId = (slot: SandboxPlayerSlot) => playerIds[slot === 'player-1' ? 0 : 1];
    const state = createStartedGameState(playerIds, playerId(position.currentTurnPlayer));
    state.cells = position.cells.map(cell => ({ x: cell.x, y: cell.y, occupiedBy: zCellOccupant.parse(playerId(cell.player)) }));
    state.placementsRemaining = position.placementsRemaining;
    state.turnCount = getCompletedTurnCount(state.cells.length);
    for (const cell of state.cells) {
        const line = findWinningLine(state, cell.occupiedBy, cell.x, cell.y);
        if (line) {
            state.winner = { playerId: cell.occupiedBy, cells: line };
            break;
        }
    }
    return state;
}
