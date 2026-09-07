export type NotationPlayer = 'x' | 'o';
export type NotationResult = {
    cells: { x: number; y: number; player: NotationPlayer }[]
    currentTurnPlayer: NotationPlayer
    placementsRemaining: number
};
export type NotationParser = (input: string) => NotationResult;

export const MAX_COORDINATE = 1000;
export const MAX_NOTATION_LENGTH = 50000;

export function requireNotation(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

export class NotationResultBuilder {
    readonly result: NotationResult = { cells: [], currentTurnPlayer: 'x', placementsRemaining: 2 };
    private readonly occupied = new Map<string, NotationPlayer>();

    add(x: number, y: number, owner: string, allowSame = false) {
        requireNotation(Number.isSafeInteger(x) && Number.isSafeInteger(y)
            && Math.abs(x) <= MAX_COORDINATE && Math.abs(y) <= MAX_COORDINATE,
        'Notation coordinates must be integers between -1000 and 1000.');
        const player = owner.toLowerCase();
        requireNotation(player === 'x' || player === 'o', 'Invalid stone owner.');
        const key = `${x},${y}`;
        if (allowSame && this.occupied.get(key) === player) return;
        requireNotation(!this.occupied.has(key), `Duplicate stone at (${x}, ${y}).`);
        requireNotation(this.result.cells.length < 2000, 'Notation can contain at most 2000 stones.');
        this.occupied.set(key, player);
        this.result.cells.push({ x: x || 0, y: y || 0, player });
    }

    nextTurn(player: NotationPlayer, moves: number) {
        this.result.currentTurnPlayer = moves === 1 ? player : player === 'x' ? 'o' : 'x';
        this.result.placementsRemaining = moves === 1 ? 1 : 2;
    }
}
