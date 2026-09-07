import assert from 'node:assert/strict';
import test from 'node:test';
import { NotationResultBuilder } from './notationResult';

test('results validate coordinates, owners, duplicates and stone limits', () => {
    const builder = new NotationResultBuilder();
    builder.add(-0, 0, 'X');
    builder.add(0, 0, 'x', true);
    assert.deepEqual(builder.result.cells, [{ x: 0, y: 0, player: 'x' }]);
    assert.throws(() => builder.add(0, 0, 'o', true));
    assert.throws(() => builder.add(0, 0, 'x'));
    assert.throws(() => builder.add(1, 0, '?'));
    for (const x of [1.5, NaN, Infinity, 1001, -1001]) assert.throws(() => builder.add(x, 0, 'x'));
    for (let x = -1000; x < 999; x++) builder.add(x, 1, 'o');
    assert.throws(() => builder.add(999, 1, 'o'));
});

test('results track complete and partial turns', () => {
    const builder = new NotationResultBuilder();
    builder.nextTurn('o', 1);
    assert.equal(builder.result.currentTurnPlayer, 'o');
    assert.equal(builder.result.placementsRemaining, 1);
    builder.nextTurn('o', 2);
    assert.equal(builder.result.currentTurnPlayer, 'x');
    assert.equal(builder.result.placementsRemaining, 2);
});
