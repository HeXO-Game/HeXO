import assert from 'node:assert/strict';
import test from 'node:test';
import { applyGameMove, zCreateSandboxPositionRequest, zSandboxPositionResponse, zSandboxGamePosition, type SandboxGamePosition } from '@ih3t/shared';
import { restoreSandboxPosition } from './sandboxPosition';

const position: SandboxGamePosition = {
    cells: [
        { x: 0, y: 0, player: 'player-1', moveId: 1 },
        { x: 1, y: 0, player: 'player-2', moveId: 2 },
        { x: 0, y: 1, player: 'player-2', moveId: 3 },
    ],
    currentTurnPlayer: 'player-1',
    placementsRemaining: 2,
};

test('existing shared positions retain their full placement history', () => {
    const restored = restoreSandboxPosition(position, ['x', 'o']);
    assert.deepEqual(restored.gameHistory.map(state => state.cells.length), [0, 1, 2, 3]);
    assert.equal(restored.gameState.currentTurnPlayerId, 'x');
});

test('sharing without history survives API serialization and fixes imported stones', () => {
    const request = zCreateSandboxPositionRequest.parse({
        name: 'Fixed board', originalPositionId: null, gamePosition: { ...position, initialCellCount: 3 },
    });
    const stored = zSandboxGamePosition.parse(JSON.parse(JSON.stringify(request.gamePosition)));
    const restored = restoreSandboxPosition(stored, ['x', 'o']);
    assert.equal(restored.gameHistory.length, 1);
    assert.equal(restored.gameHistory[0].cells.length, 3);
    applyGameMove(restored.gameState, { playerId: 'x', x: 1, y: 1 });
    assert.equal(restored.gameState.cells.length, 4);
    assert.equal(restored.gameHistory[0].cells.length, 3);
});

test('resharing preserves fixed stones while allowing new moves to be undone', () => {
    for (const initialCellCount of [1, 2]) {
        const restored = restoreSandboxPosition({ ...position, initialCellCount }, ['x', 'o']);
        assert.equal(restored.gameHistory.length, 4 - initialCellCount);
        assert.equal(restored.gameHistory[0].cells.length, initialCellCount);
        assert.equal(restored.gameState.currentTurnPlayerId, 'x');
        assert.equal(restored.gameState.placementsRemaining, 2);
    }
    const partial = restoreSandboxPosition({ ...position, cells: position.cells.slice(0, 2),
        initialCellCount: 1, currentTurnPlayer: 'player-2', placementsRemaining: 1 }, ['x', 'o']);
    assert.equal(partial.gameHistory[0].currentTurnPlayerId, 'o');
    assert.equal(partial.gameHistory[0].placementsRemaining, 2);
    assert.equal(partial.gameState.placementsRemaining, 1);
});

test('fixed formations do not require a legal opening sequence', () => {
    const restored = restoreSandboxPosition({ ...position, initialCellCount: 3,
        cells: position.cells.map(cell => ({ ...cell, x: cell.x + 10, player: 'player-1' })) }, ['x', 'o']);
    assert.equal(restored.gameHistory.length, 1);
    assert.equal(restored.gameState.cells.length, 3);
});

test('invalid history boundaries are rejected', () => {
    for (const initialCellCount of [-1, 1.5, 4]) {
        assert.throws(() => restoreSandboxPosition({ ...position, initialCellCount }, ['x', 'o']));
    }
    assert.throws(() => restoreSandboxPosition({ ...position, initialCellCount: 3,
        cells: [position.cells[0], position.cells[0], position.cells[2]] }, ['x', 'o']));
});

test('source sandbox IDs survive the API contract and require an explicit source ID or null', () => {
    const request = zCreateSandboxPositionRequest.parse({ name: 'Derived', gamePosition: position, originalPositionId: 'src1234' });
    const response = zSandboxPositionResponse.parse({ id: 'new1234', ...request });
    assert.equal(response.originalPositionId, 'src1234');
    assert.equal(zCreateSandboxPositionRequest.parse({ name: 'Fresh', gamePosition: position, originalPositionId: null }).originalPositionId, null);
    assert.throws(() => zSandboxPositionResponse.parse({ id: 'old1234', name: 'Legacy', gamePosition: position }));
    assert.throws(() => zCreateSandboxPositionRequest.parse({ name: 'Missing source', gamePosition: position }));
    assert.throws(() => zCreateSandboxPositionRequest.parse({ name: 'Invalid', gamePosition: position, originalPositionId: 'not-an-id' }));
});
