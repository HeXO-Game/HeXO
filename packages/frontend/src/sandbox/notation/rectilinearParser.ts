// Adapted from MineKing9534/HeXO (MIT); see ../HeXO-LICENSE.txt.
import { NotationResultBuilder, requireNotation, MAX_COORDINATE, type NotationParser } from './notationResult';

export const parseRectilinear: NotationParser = (value) => {
    const builder = new NotationResultBuilder();
    const column = value.startsWith('c');
    let row = 0;
    let offset = 0;
    for (let i = column ? 1 : 0; i < value.length;) {
        const char = value[i++];
        if (char === ' ' || char === '\t') continue;
        if (char === '/' || char === '\n') { row++; offset = 0; continue; }
        if (char === '[') {
            requireNotation(offset > 0, 'A label must follow a cell.');
            let depth = 1;
            while (i < value.length && depth) {
                const next = value[i++];
                if (next === '\\') i++;
                else if (next === '[') depth++;
                else if (next === ']') depth--;
            }
            requireNotation(depth === 0, 'Unterminated cell label.');
            continue;
        }
        if (char === '(') {
            const end = value.indexOf(')', i);
            requireNotation(end >= 0, 'Unterminated highlight.');
            const highlight = value.slice(i, end);
            requireNotation(/^\s*(?:[bdpq<>]\s*\d*\s*)?[xo!]?\s*$/.test(highlight), 'Invalid highlight.');
            requireNotation(offset > 0 || /[bdpq<>]/.test(highlight), 'A highlight must follow a cell.');
            i = end + 1;
            continue;
        }
        if (/\d/.test(char)) {
            const digits = value.slice(i - 1).match(/^\d+/)![0];
            const gap = Number(digits);
            requireNotation(Number.isSafeInteger(gap) && gap <= MAX_COORDINATE, 'Empty-cell gap is too large.');
            offset += gap;
            i += digits.length - 1;
            continue;
        }
        requireNotation('xoXO.!-'.includes(char), `Unexpected notation character: ${char}`);
        if ('xoXO'.includes(char)) builder.add(column ? row : offset, column ? offset : row, char);
        offset += char === '-' ? 2 : 1;
    }
    return builder.result;
};
