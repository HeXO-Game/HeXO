import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCombined } from './combinedParser';

const stones = (text: string) => parseCombined(text).cells.map(({ x, y, player }) => [x, y, player]);

test('combined notation honors explicit origins and commas in labels', () => {
    const expected = [
        [1, 0, 'x'], [0, 1, 'x'], [1, 1, 'x'],
        [1, -1, 'o'], [2, -1, 'o'], [-1, 2, 'x'], [0, 2, 'x'],
    ];
    assert.deepEqual(stones('.x/xx, b@(1,0): o A0 A1 x B3.1 B3.2').sort(), [...expected].sort());
    assert.deepEqual(stones('.x[a,b]/xx, d o A0 B1 x B2.0 B2.1').sort(), [...expected].sort());
    assert.deepEqual(stones('x/oo, o A2'), [[0, 0, 'x'], [0, 1, 'o'], [1, 1, 'o']]);
});

test('combined rejects invalid input', () => {
    for (const input of ['x/oo, x A2', 'x/oo, o A2 A2']) assert.throws(() => parseCombined(input), Error, input);
});
