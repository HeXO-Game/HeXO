import { AUTH_USERS_COLLECTION_NAME, BOT_TOKENS_COLLECTION_NAME } from '../mongoCollections';
import type { DatabaseMigration } from './types';

export const botAccountsMigration: DatabaseMigration = {
    id: `013-bot-accounts`,
    description: `Mark existing users as human and index bot accounts and their tokens`,
    async up({ database }) {
        const users = database.collection(AUTH_USERS_COLLECTION_NAME);
        await users.updateMany(
            { kind: { $exists: false } },
            { $set: { kind: `human` } },
        );
        await users.createIndex(
            { kind: 1, ownerProfileId: 1 },
            { partialFilterExpression: { kind: `bot` } },
        );

        const botTokens = database.collection(BOT_TOKENS_COLLECTION_NAME);
        await botTokens.createIndex({ tokenHash: 1 }, { unique: true });
        await botTokens.createIndex({ botProfileId: 1 }, { unique: true });
    },
};
