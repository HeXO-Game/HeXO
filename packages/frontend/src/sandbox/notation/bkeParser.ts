// Adapted from MineKing9534/HeXO (MIT); see ../HeXO-LICENSE.txt.
import { NotationResultBuilder, requireNotation, MAX_COORDINATE, type NotationResult } from './notationResult';

const directions = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const symbols = '>qp<bd';

export function parseBke(value: string, implicitOrigin = true): NotationResult {
    const builder = new NotationResultBuilder();
    if (value.trim() === '0') {
        builder.add(0, 0, 'x'); builder.result.currentTurnPlayer = 'o'; return builder.result;
    }
    const prefix = value.match(/^\s*([bdpq<>])?\s*(CW|CCW)?\s*(?:@\s*\((-?\d+),\s*(-?\d+)\)\s*:?)?\s*/)!;
    requireNotation(!implicitOrigin || prefix[3] === undefined, 'An explicit BKE origin requires a rectilinear starting position.');
    const originX = Number(prefix[3] ?? 0);
    const originY = Number(prefix[4] ?? 0);
    const direction = symbols.indexOf(prefix[1] ?? 'd');
    const parts = value.slice(prefix[0].length).trim().split(/\s+/);
    if (implicitOrigin) builder.add(0, 0, 'x');
    for (let i = 0; i < parts.length;) {
        const owner = parts[i++];
        requireNotation(owner === 'x' || owner === 'o', 'BKE turns must start with x or o.');
        let moves = 0;
        while (i < parts.length && parts[i] !== 'x' && parts[i] !== 'o') {
            const match = parts[i++].match(/^([A-Z]+)(?:([0-5])\.)?(\d+)$/);
            requireNotation(match, 'Invalid BKE ring or offset.');
            let ring = 0;
            for (const letter of match[1]) {
                ring = ring * 26 + letter.charCodeAt(0) - 64;
                requireNotation(ring <= MAX_COORDINATE, 'BKE ring is too large.');
            }
            let offset = Number(match[3]) + Number(match[2] ?? 0) * ring;
            requireNotation(Number.isSafeInteger(offset) && offset < ring * 6, 'BKE offset is outside its ring.');
            if (prefix[2] === 'CCW') offset = (ring * 6 - offset) % (ring * 6);
            const sector = Math.floor(offset / ring);
            let x = originX + directions[direction][0] * ring;
            let y = originY + directions[direction][1] * ring;
            for (let side = 0; side <= sector; side++) {
                const [dx, dy] = directions[(direction + side + 2) % 6];
                const distance = side === sector ? offset % ring : ring;
                x += dx * distance; y += dy * distance;
            }
            builder.add(x, y, owner); moves++;
        }
        requireNotation(moves > 0, 'BKE turns must contain a move.');
        builder.nextTurn(owner, moves);
    }
    return builder.result;
}
