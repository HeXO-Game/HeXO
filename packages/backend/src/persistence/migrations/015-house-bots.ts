import { AUTH_USERS_COLLECTION_NAME } from '../mongoCollections';
import type { DatabaseMigration } from './types';

export const houseBotsMigration: DatabaseMigration = {
    id: `015-house-bots`,
    description: `Give every bot a driver and index the house bots' keys`,
    async up({ database }) {
        const users = database.collection(AUTH_USERS_COLLECTION_NAME);
        await users.updateMany(
            { kind: `bot`, driver: { $exists: false } },
            { $set: { driver: { type: `stream` } } },
        );
        /* The house bots themselves are seeded by the service, flag on: a server that
         * never enables bots never gains a searchable bot user. */
        await users.createIndex(
            { houseKey: 1 },
            { unique: true, partialFilterExpression: { houseKey: { $exists: true } } },
        );
    },
};
