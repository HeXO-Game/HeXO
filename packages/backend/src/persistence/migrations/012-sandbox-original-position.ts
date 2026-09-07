import { SANDBOX_POSITIONS_COLLECTION_NAME } from '../mongoCollections';
import type { DatabaseMigration } from './types';

export const sandboxOriginalPositionMigration: DatabaseMigration = {
    id: `012-sandbox-original-position`,
    description: `Set explicit null source IDs on existing sandbox positions`,
    async up({ database }) {
        await database.collection(SANDBOX_POSITIONS_COLLECTION_NAME).updateMany(
            { originalPositionId: { $exists: false } },
            { $set: { originalPositionId: null } },
        );
    },
};
