import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRectilinear } from './rectilinearParser';

const stones = (text: string) => parseRectilinear(text).cells.map(({ x, y, player }) => [x, y, player]);

test('rectilinear rows, columns, gaps, labels and highlights', () => {
    const expected = [[0, 0, 'x'], [3, 0, 'x'], [0, 1, 'o'], [2, 1, 'o'], [0, 3, 'x']];
    assert.deepEqual(stones('x-x/o.o//x'), expected);
    assert.deepEqual(stones('X(!)-x[label, [nested]\\] text]\no.o\n\nx'), expected);
    assert.deepEqual(stones('x2x'), stones('x-x'));
    assert.deepEqual(stones('x..x'), stones('x-x'));
    assert.deepEqual(stones('cx-x/o.o//x'), expected.map(([x, y, player]) => [y, x, player]));
    assert.deepEqual(stones('-x(>4o)'), [[2, 0, 'x']]);
});

test('rectilinear rejects invalid input', () => {
    for (const input of ['x[', 'x(!', 'x(z)', 'x[abc', 'x?o', 'x999999999999999x']) assert.throws(() => parseRectilinear(input), Error, input);
});
