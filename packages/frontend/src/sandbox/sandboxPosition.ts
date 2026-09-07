import { applyGameMove, cloneGameState, createStartedGameState, zSandboxGamePosition, type SandboxGamePosition, type SandboxPlayerSlot } from '@ih3t/shared';
import { createNotationGameState } from './sandboxNotation';

export function restoreSandboxPosition(position: SandboxGamePosition, playerIds: readonly [string, string]) {
    zSandboxGamePosition.parse(position);
    const cells = [...position.cells].sort((left, right) => left.moveId - right.moveId);
    if (new Set(cells.map(cell => `${cell.x},${cell.y}`)).size !== cells.length) {
        throw new Error(`Sandbox position contains duplicate stones.`);
    }
    const initialCellCount = position.initialCellCount ?? 0;
    const playerId = (player: SandboxPlayerSlot) => playerIds[player === 'player-1' ? 0 : 1];
    let currentTurnPlayer = position.currentTurnPlayer;
    let placementsRemaining = position.placementsRemaining;
    // Reverse only the playable moves to recover the fixed board's turn state.
    for (let i = cells.length; i > initialCellCount; i--) {
        if (placementsRemaining === 2) {
            currentTurnPlayer = currentTurnPlayer === 'player-1' ? 'player-2' : 'player-1';
            placementsRemaining = 1;
        } else {
            placementsRemaining = 2;
        }
    }
    const gameState = initialCellCount > 0
        ? createNotationGameState({ cells: cells.slice(0, initialCellCount), currentTurnPlayer, placementsRemaining }, playerIds)
        : createStartedGameState(playerIds, playerId(cells[0]?.player ?? 'player-1'));
    const gameHistory = [cloneGameState(gameState)];
    for (const cell of cells.slice(initialCellCount)) {
        applyGameMove(gameState, { playerId: playerId(cell.player), x: cell.x, y: cell.y });
        gameHistory.push(cloneGameState(gameState));
    }
    if (gameState.currentTurnPlayerId !== playerId(position.currentTurnPlayer)
        || gameState.placementsRemaining !== position.placementsRemaining) {
        throw new Error(`Sandbox position is inconsistent.`);
    }
    return { gameState, gameHistory };
}
