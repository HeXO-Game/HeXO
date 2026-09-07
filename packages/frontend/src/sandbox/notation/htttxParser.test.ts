import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHtttx } from './htttxParser';

test('HTTTX converts axial coordinates and tracks the next turn', () => {
    const result = parseHtttx('version[1]; 1. [0,1][1,-1]; 2. [1,0][-1,0]; 3. [2,0][-4,0];');
    assert.deepEqual(result.cells.map(({ x, y, player }) => [x, y, player]), [[0, 0, 'x'], [1, -1, 'o'], [0, 1, 'o'], [1, 0, 'x'], [-1, 0, 'x'], [2, 0, 'o'], [-4, 0, 'o']]);
    assert.equal(result.currentTurnPlayer, 'x');
    assert.equal(parseHtttx('version[1]; 1. [1,0];').placementsRemaining, 1);
});

test('HTTTX rejects unsupported versions, turn gaps and duplicate cells', () => {
    for (const input of ['version[2]; 1. [1,0];', 'version[1]; 2. [1,0];', 'version[1]; 1. [0,0];', 'version[1];']) {
        assert.throws(() => parseHtttx(input), Error, input);
    }
});
