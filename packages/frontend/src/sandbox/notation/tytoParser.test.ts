import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTyto } from './tytoParser';

test('Tyto decodes stones, padding and partial turns', () => {
    assert.deepEqual(parseTyto('AgEAAgIAAQAEAAcA').cells.map(({ x, y, player }) => [x, y, player]), [[0, 0, 'x'], [1, -1, 'o'], [0, 1, 'o'], [1, 0, 'x'], [-1, 0, 'x'], [2, 0, 'o'], [-4, 0, 'o']]);
    assert.deepEqual(parseTyto('').cells, [{ x: 0, y: 0, player: 'x' }]);
    assert.deepEqual(parseTyto('cAA=').cells, [{ x: 0, y: 0, player: 'x' }, { x: 56, y: 0, player: 'o' }]);
    assert.deepEqual(parseTyto('AgA='), parseTyto('AgA'));
    assert.equal(parseTyto('AgA').placementsRemaining, 1);
});

test('Tyto rejects malformed base64, truncated integers and duplicate stones', () => {
    for (const input of ['?', 'Ag', 'gA', 'AAAA']) assert.throws(() => parseTyto(input), Error, input);
});
