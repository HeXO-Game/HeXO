import assert from 'node:assert/strict';
import test from 'node:test';
import { createStartedGameState } from '@ih3t/shared';
import { editSandboxCell } from './sandboxPlacement';

test('editing cycles stones, replaces them, preserves turns and leaves undo snapshots untouched', () => {
    const ids = ['x', 'o'] as const;
    const empty = createStartedGameState(ids, 'x');
    const x = editSandboxCell(empty, 'toggle', 4, 2, ids);
    const o = editSandboxCell(x, 'toggle', 4, 2, ids);
    const removed = editSandboxCell(o, 'toggle', 4, 2, ids);
    assert.equal(empty.cells.length, 0);
    assert.equal(x.cells[0].occupiedBy, 'x');
    assert.equal(o.cells[0].occupiedBy, 'o');
    assert.equal(removed.cells.length, 0);
    assert.equal(o.currentTurnPlayerId, empty.currentTurnPlayerId);
    assert.equal(o.placementsRemaining, empty.placementsRemaining);
    assert.equal(editSandboxCell(o, 'player-1', 4, 2, ids).cells[0].occupiedBy, 'x');
    assert.equal(editSandboxCell(x, 'player-2', 4, 2, ids).cells.length, 1);
    assert.equal(editSandboxCell(x, 'player-1', 4, 2, ids).cells.length, 0);
    assert.equal(editSandboxCell(o, 'player-2', 4, 2, ids).cells.length, 0);
    assert.equal(editSandboxCell(empty, 'player-1', 4, 2, ids).cells[0].occupiedBy, 'x');
    assert.equal(editSandboxCell(empty, 'player-2', 4, 2, ids).cells[0].occupiedBy, 'o');
    let line = empty;
    for (let i = 0; i < 6; i++) line = editSandboxCell(line, 'player-1', i, 0, ids);
    assert.equal(line.winner?.playerId, 'x');
    assert.equal(editSandboxCell(line, 'toggle', 0, 0, ids).winner, null);
});
