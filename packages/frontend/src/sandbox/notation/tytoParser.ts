// Adapted from MineKing9534/HeXO (MIT); see ../HeXO-LICENSE.txt.
import { NotationResultBuilder, requireNotation, type NotationParser } from './notationResult';

export const parseTyto: NotationParser = (value) => {
    const builder = new NotationResultBuilder();
    requireNotation(/^[A-Za-z0-9+/]*={0,2}$/.test(value), 'Invalid Tyto base64 notation.');
    let bytes: string;
    try { bytes = atob(value); } catch { throw new Error('Invalid Tyto base64 notation.'); }
    let offset = 0;
    function integer() {
        let shift = 0;
        while (offset < bytes.length && bytes.charCodeAt(offset) === 128) {
            offset++; shift += 7;
            requireNotation(shift <= 28, 'Tyto coordinate is too large.');
        }
        requireNotation(offset < bytes.length, 'Incomplete Tyto coordinate.');
        const value = (bytes.charCodeAt(offset++) & 127) * 2 ** shift;
        return value % 2 ? -(value + 1) / 2 : value / 2;
    }
    builder.add(0, 0, 'x'); builder.result.currentTurnPlayer = 'o';
    let count = 0;
    while (offset < bytes.length) {
        const owner = Math.floor(count / 2) % 2 === 0 ? 'o' : 'x';
        builder.add(integer(), integer(), owner);
        builder.nextTurn(owner, count % 2 + 1); count++;
    }
    return builder.result;
};
