// Adapted from MineKing9534/HeXO (MIT); see ../HeXO-LICENSE.txt.
import { parseBke } from './bkeParser';
import { parseRectilinear } from './rectilinearParser';
import { NotationResultBuilder, requireNotation, type NotationParser } from './notationResult';

export function findNotationSeparator(text: string) {
    // Commas inside labels do not split combined notation.
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\\') { i++; continue; }
        if (text[i] === '[') depth++;
        if (text[i] === ']') depth--;
        if (text[i] === ',' && depth === 0) return i;
    }
    return -1;
}

export const parseCombined: NotationParser = (text) => {
    const separator = findNotationSeparator(text);
    requireNotation(separator >= 0, 'Combined notation requires a comma between the layout and moves.');
    const layout = parseRectilinear(text.slice(0, separator));
    const moves = parseBke(text.slice(separator + 1), false);
    const builder = new NotationResultBuilder();
    for (const cell of layout.cells) builder.add(cell.x, cell.y, cell.player);
    for (const cell of moves.cells) builder.add(cell.x, cell.y, cell.player, true);
    return { ...builder.result, currentTurnPlayer: moves.currentTurnPlayer, placementsRemaining: moves.placementsRemaining };
};
