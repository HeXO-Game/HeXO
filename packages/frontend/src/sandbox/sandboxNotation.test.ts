import assert from 'node:assert/strict';
import test from 'node:test';
import { applyGameMove, cloneGameState } from '@ih3t/shared';
import { createNotationGameState, parseSandboxNotation } from './sandboxNotation';

test('notation results are converted to sandbox players and move IDs', () => {
    assert.deepEqual(parseSandboxNotation('o A0'), {
        cells: [
            { x: 0, y: 0, player: 'player-1', moveId: 1 },
            { x: 1, y: -1, player: 'player-2', moveId: 2 },
        ],
        currentTurnPlayer: 'player-2',
        placementsRemaining: 1,
    });
});

test('arbitrary formations become playable baselines and existing wins are detected', () => {
    const position = parseSandboxNotation('.x/xx');
    const state = createNotationGameState(position, ['x', 'o']);
    const baseline = cloneGameState(state);
    applyGameMove(state, { playerId: state.currentTurnPlayerId!, x: 2, y: 0 });
    assert.equal(state.cells.length, 4);
    assert.equal(baseline.cells.length, 3);
    assert.equal(baseline.winner, null);
    assert.equal(createNotationGameState(parseSandboxNotation('xxxxxx'), ['x', 'o']).winner?.playerId, 'x');
});
