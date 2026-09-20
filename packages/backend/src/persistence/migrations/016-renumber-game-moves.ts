import { GAME_HISTORY_COLLECTION_NAME } from '../mongoCollections';
import type { DatabaseMigration } from './types';

/**
 * Games recorded before the one-write-per-turn fix numbered every stone one ahead:
 * the origin landed as move 2, so a document from that code starts at 2 while every
 * newer one starts at 1. The discriminator is the first move's number, not a
 * timestamp — the fixed code ran in production before this migration existed, and
 * its correctly-numbered documents carry no marker either. `moveNumbering: 1` is
 * set by the fix's own writes and here, so however often this runs, a document
 * moves at most once.
 */
export const renumberGameMovesMigration: DatabaseMigration = {
    id: `016-renumber-game-moves`,
    description: `Shift move numbers down by one on games recorded with the old one-ahead numbering`,
    async up({ database }) {
        await database.collection(GAME_HISTORY_COLLECTION_NAME).updateMany(
            { moveNumbering: { $ne: 1 }, 'moves.0.moveNumber': 2 },
            [
                {
                    $set: {
                        moveNumbering: 1,
                        moves: {
                            $map: {
                                input: `$moves`,
                                as: `move`,
                                in: {
                                    $mergeObjects: [
                                        `$$move`,
                                        { moveNumber: { $subtract: [`$$move.moveNumber`, 1] } },
                                    ],
                                },
                            },
                        },
                    },
                },
            ],
        );
    },
};
