import { AUTH_USERS_COLLECTION_NAME } from '../mongoCollections';
import type { DatabaseMigration } from './types';

export const boardThemePreferencesMigration: DatabaseMigration = {
    id: `009-board-theme-preferences`,
    description: `Replace the tile marker preference with board themes`,
    async up({ database, logger }) {
        const users = database.collection(AUTH_USERS_COLLECTION_NAME);
        const markerUsers = await users.updateMany(
            {
                'preferences.boardTheme': { $exists: false },
                'preferences.tilePieceMarkers': true,
            },
            {
                $set: { 'preferences.boardTheme': `marker` },
                $unset: { 'preferences.tilePieceMarkers': `` },
            },
        );
        const normalUsers = await users.updateMany(
            {
                preferences: { $exists: true },
                'preferences.boardTheme': { $exists: false },
            },
            {
                $set: { 'preferences.boardTheme': `normal` },
                $unset: { 'preferences.tilePieceMarkers': `` },
            },
        );
        const cleanedUsers = await users.updateMany(
            { 'preferences.tilePieceMarkers': { $exists: true } },
            { $unset: { 'preferences.tilePieceMarkers': `` } },
        );

        logger.info({
            markerUsers: markerUsers.modifiedCount,
            normalUsers: normalUsers.modifiedCount,
            cleanedUsers: cleanedUsers.modifiedCount,
        }, `Migrated board theme preferences`);
    },
};
