import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNotation } from './parseNotation';
import { MAX_NOTATION_LENGTH } from './notationResult';

test('format detection handles wrappers, links and ambiguous Tyto prefixes', () => {
    assert.deepEqual(parseNotation('```\r\nx-x/o.o//x\r\n```'), parseNotation('x-x/o.o//x'));
    assert.deepEqual(parseNotation('`x`'), parseNotation('x'));
    assert.deepEqual(parseNotation('#https://hexo.tyto.cc/analysis#c=AgEAAgIAAQAEAAcA'), parseNotation('AgEAAgIAAQAEAAcA'));
    assert.deepEqual(parseNotation('https://hexo.tyto.cc/analysis#c='), parseNotation('0'));
    assert.deepEqual(parseNotation('cAA='), parseNotation('https://hexo.tyto.cc/analysis#c=cAA='));
    assert.deepEqual(parseNotation('version[1]; 1. [0,1][1,-1];'), parseNotation('o A0 A2'));
    assert.deepEqual(parseNotation('x/oo, o A2').cells, parseNotation('x/oo').cells);
});

test('format detection rejects empty and excessive input', () => {
    for (const input of ['', '.', 'x'.repeat(MAX_NOTATION_LENGTH + 1)]) assert.throws(() => parseNotation(input));
});
