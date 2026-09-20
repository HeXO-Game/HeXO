import assert from 'node:assert/strict';
import test from 'node:test';

import type { Db, Document } from 'mongodb';
import pino from 'pino';

import { GAME_HISTORY_COLLECTION_NAME } from '../mongoCollections';
import { renumberGameMovesMigration } from './016-renumber-game-moves';

function oldNumberedGame(id: string, moveNumbers: number[]): Document {
    return {
        _id: id,
        moves: moveNumbers.map((moveNumber, index) => ({ moveNumber, playerId: `p${index % 2}`, x: index, y: 0, timestamp: index })),
    };
}

test(`migration shifts every move of an old-numbered game down by one, once`, async () => {
    const documents: Document[] = [
        oldNumberedGame(`old`, [2, 3, 4, 5]),
        { _id: `new`, moveNumbering: 1, moves: [{ moveNumber: 1, playerId: `p1`, x: 0, y: 0, timestamp: 0 }, { moveNumber: 2, playerId: `p2`, x: 1, y: 0, timestamp: 1 }] },
        /* Written by the fixed code before the marker existed: numbered from 1, and
         * must not move just because it carries no marker. */
        { _id: `unmarked-but-correct`, moves: [{ moveNumber: 1, playerId: `p1`, x: 0, y: 0, timestamp: 0 }] },
        oldNumberedGame(`aborted-empty`, []),
        { _id: `already-migrated`, moveNumbering: 1, ...oldNumberedGame(`x`, [2, 3]) },
    ];

    const database = {
        collection(name: string) {
            assert.equal(name, GAME_HISTORY_COLLECTION_NAME);
            return {
                async updateMany(filter: Document, update: Document) {
                    /* The contract under test: unmarked documents whose first move
                     * reads 2 — and only those — take one pipeline update that marks
                     * them and shifts every move number. */
                    assert.deepEqual(filter, { moveNumbering: { $ne: 1 }, 'moves.0.moveNumber': 2 });
                    assert.ok(Array.isArray(update), `the update is a pipeline`);
                    assert.deepEqual(update[0]?.$set?.moveNumbering, 1);

                    for (const document of documents) {
                        const unmarked = document.moveNumbering !== 1;
                        const startsAtTwo = document.moves?.[0]?.moveNumber === 2;
                        if (unmarked && startsAtTwo) {
                            document.moveNumbering = 1;
                            document.moves = document.moves.map((move: { moveNumber: number }) => ({
                                ...move,
                                moveNumber: move.moveNumber - 1,
                            }));
                        }
                    }
                },
            };
        },
    } as unknown as Db;

    await renumberGameMovesMigration.up({ database, logger: pino({ enabled: false }) });

    assert.deepEqual(documents.find((document) => document._id === `old`)?.moves?.map((move: { moveNumber: number }) => move.moveNumber), [1, 2, 3, 4]);
    assert.equal(documents.find((document) => document._id === `old`)?.moveNumbering, 1);
    assert.deepEqual(
        documents.find((document) => document._id === `new`)?.moves?.map((move: { moveNumber: number }) => move.moveNumber),
        [1, 2],
        `a marked document is untouched`,
    );
    assert.deepEqual(
        documents.find((document) => document._id === `unmarked-but-correct`)?.moves?.map((move: { moveNumber: number }) => move.moveNumber),
        [1],
        `a document already numbered from 1 keeps its numbers`,
    );
    assert.deepEqual(documents.find((document) => document._id === `aborted-empty`)?.moves, [], `a game without moves has nothing to shift`);

    const migrated = structuredClone(documents);
    await renumberGameMovesMigration.up({ database, logger: pino({ enabled: false }) });
    assert.deepEqual(documents, migrated, `a second run changes nothing`);
});
