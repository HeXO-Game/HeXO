import type { GameState, SandboxPlayerSlot } from '@ih3t/shared';
import { createNotationGameState } from './sandboxNotation';

export type SandboxPlacementMode = 'turn' | 'toggle' | SandboxPlayerSlot;

export function editSandboxCell(state: GameState, mode: Exclude<SandboxPlacementMode, 'turn'>,
    x: number, y: number, playerIds: readonly [string, string]): GameState {
    const existing = state.cells.find(cell => cell.x === x && cell.y === y);
    let player: SandboxPlayerSlot | null = mode === 'toggle' ? 'player-1' : mode;
    if (mode === 'toggle' && existing) {
        player = existing.occupiedBy === playerIds[0] ? 'player-2' : null;
    } else if (mode !== 'toggle' && existing?.occupiedBy === playerIds[mode === 'player-1' ? 0 : 1]) {
        player = null;
    }
    const cells = state.cells.filter(cell => cell !== existing).map((cell, index) => ({
        x: cell.x, y: cell.y,
        player: (cell.occupiedBy === playerIds[0] ? 'player-1' : 'player-2') as SandboxPlayerSlot,
        moveId: index + 1,
    }));
    if (player) cells.push({ x, y, player, moveId: cells.length + 1 });
    return createNotationGameState({
        cells,
        currentTurnPlayer: state.currentTurnPlayerId === playerIds[1] ? 'player-2' : 'player-1',
        placementsRemaining: state.placementsRemaining || 1,
    }, playerIds);
}
