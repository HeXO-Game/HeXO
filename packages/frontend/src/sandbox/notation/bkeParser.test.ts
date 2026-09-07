import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBke } from './bkeParser';

const stones = (text: string) => parseBke(text).cells.map(({ x, y, player }) => [x, y, player]);

test('BKE directions, chirality, sector addressing and multi-letter rings match upstream coordinates', () => {
    assert.deepEqual(stones('o A0 A2 x A1 A4 o B1.0 D4.0'), [
        [0, 0, 'x'], [1, -1, 'o'], [0, 1, 'o'],
        [1, 0, 'x'], [-1, 0, 'x'], [2, 0, 'o'], [-4, 0, 'o'],
    ]);
    assert.deepEqual(stones('p CCW x A0 A1 o A3 A4 x B0 B1'), [
        [0, 0, 'x'], [-1, 1, 'x'], [0, 1, 'x'],
        [1, -1, 'o'], [0, -1, 'o'], [-2, 2, 'x'], [-1, 2, 'x'],
    ]);
    assert.deepEqual(stones('x Z0 AA0 AB0').slice(1), [[26, -26, 'x'], [27, -27, 'x'], [28, -28, 'x']]);
    for (const direction of ['>', 'q', 'p', '<', 'b', 'd']) {
        assert.deepEqual(stones(`${direction} o B1.1`), stones(`${direction} o B3`));
    }
    assert.equal(parseBke('o A0').placementsRemaining, 1);
    assert.equal(parseBke('o A0').currentTurnPlayer, 'o');
    assert.equal(parseBke('o A0 A1').currentTurnPlayer, 'x');
});

test('bke rejects invalid input', () => {
    for (const input of ['o A6', 'o A0 A0', 'x AA9999', 'x A0 trailing', 'o ZZZZZ0']) assert.throws(() => parseBke(input), Error, input);
});
