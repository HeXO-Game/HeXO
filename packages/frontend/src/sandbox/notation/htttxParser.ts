// Adapted from MineKing9534/HeXO (MIT); see ../HeXO-LICENSE.txt.
import { NotationResultBuilder, requireNotation, type NotationParser } from './notationResult';

export const parseHtttx: NotationParser = (value) => {
    const builder = new NotationResultBuilder();
    const statements = value.split(';').map(part => part.trim()).filter(Boolean);
    requireNotation(statements[0] === 'version[1]', 'Only HTTTX version 1 is supported.');
    requireNotation(statements.length > 1, 'HTTTX must contain a turn.');
    builder.add(0, 0, 'x');
    statements.slice(1).forEach((statement, index) => {
        const turn = statement.match(/^(\d+)\.\s*((?:\[\s*-?\d+\s*,\s*-?\d+\s*\]\s*)+)$/);
        requireNotation(turn && Number(turn[1]) === index + 1, `Expected HTTTX turn ${index + 1}.`);
        const owner = index % 2 === 0 ? 'o' : 'x';
        let moves = 0;
        for (const match of turn[2].matchAll(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/g)) {
            const q = Number(match[1]); const r = Number(match[2]);
            builder.add(q + r, -r, owner); moves++;
        }
        builder.nextTurn(owner, moves);
    });
    return builder.result;
};
