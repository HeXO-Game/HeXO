import { GAME_HISTORY_COLLECTION_NAME } from '../mongoCollections';
import type { DatabaseMigration } from './types';

export const botHistoryIsBotMigration: DatabaseMigration = {
    id: `014-bot-history-is-bot`,
    description: `Backfill the seat kind on recorded games so the history badge can render`,
    async up({ database }) {
        /* A no-op by construction — no game recorded before the bot platform can hold a
         * bot seat — but it keeps every document schema-exact. */
        await database.collection(GAME_HISTORY_COLLECTION_NAME).updateMany(
            { 'players.isBot': { $exists: false }, players: { $type: `array` } },
            { $set: { 'players.$[].isBot': false } },
        );
    },
};
