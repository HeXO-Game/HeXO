import { parseBke } from './bkeParser';
import { findNotationSeparator, parseCombined } from './combinedParser';
import { parseHtttx } from './htttxParser';
import { parseRectilinear } from './rectilinearParser';
import { parseTyto } from './tytoParser';
import { MAX_NOTATION_LENGTH, requireNotation, type NotationParser, type NotationResult } from './notationResult';

export const parseNotation: NotationParser = (input) => {
    requireNotation(input.length <= MAX_NOTATION_LENGTH, 'Notation is too long.');
    let text = input.trim().replace(/\r\n?/g, '\n');
    if (text.startsWith('```') && text.endsWith('```')) text = text.slice(3, -3).trim();
    else if (text.startsWith('`') && text.endsWith('`')) text = text.slice(1, -1).trim();
    if (text.startsWith('#')) text = text.slice(1);
    requireNotation(text.length > 0, 'Enter a board notation.');

    let result: NotationResult;
    if (text.startsWith('https://hexo.tyto.cc/analysis#c=')) {
        result = parseTyto(text.slice('https://hexo.tyto.cc/analysis#c='.length));
    } else if (text.startsWith('version[')) {
        result = parseHtttx(text);
    } else if (findNotationSeparator(text) >= 0) {
        result = parseCombined(text);
    } else if (text === '0' || /[xo]\s+[A-Z]+\d/.test(text)) {
        result = parseBke(text);
    } else if (/^[cxoXO.!/\s\d(\[\-]/.test(text)) {
        try {
            result = parseRectilinear(text);
        } catch (error) {
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw error;
            result = parseTyto(text);
        }
    } else {
        result = parseTyto(text);
    }
    requireNotation(result.cells.length > 0, 'Notation must contain at least one stone.');
    return result;
};
