import { applyGameMove, createStartedGameState, type FinishedGameRecord } from '@ih3t/shared';

export function getReplayClocks(game: FinishedGameRecord, visibleMoveCount: number): Record<string, number | null> {
    const control = game.gameOptions.timeControl;
    const initialTime = control.mode === `match` ? control.mainTimeMs : control.mode === `turn` ? control.turnTimeMs : null;
    const clocks = Object.fromEntries(game.players.map(player => [player.playerId, initialTime]));
    if (control.mode === `unlimited` || game.players.length === 0) return clocks;

    const firstPlayer = game.moves[0]?.playerId ?? game.players[game.gameOptions.firstPlayer === `guest` ? 1 : 0]?.playerId;
    const state = createStartedGameState(game.players.map(player => player.playerId), firstPlayer);
    let previousTimestamp = game.startedAt;
    for (const move of game.moves.slice(0, visibleMoveCount)) {
        clocks[move.playerId] = Math.max(0, (clocks[move.playerId] ?? initialTime!) - Math.max(0, move.timestamp - previousTimestamp));
        const { turnCompleted } = applyGameMove(state, move);
        if (turnCompleted) {
            if (control.mode === `match`) clocks[move.playerId]! += control.incrementMs;
            if (control.mode === `turn` && state.currentTurnPlayerId) clocks[state.currentTurnPlayerId] = control.turnTimeMs;
        }
        previousTimestamp = move.timestamp;
    }
    return clocks;
}
