import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { GameHistoryRepository } from './gameHistoryRepository';

test('undecided games neither extend nor break current and longest win streaks', async () => {
    const server = await MongoMemoryServer.create();
    const client = new MongoClient(server.getUri());
    try {
        await client.connect();
        const collection = client.db().collection('games');
        const repository: GameHistoryRepository = Object.assign(Object.create(GameHistoryRepository.prototype), {
            getCollection: async () => collection,
        });
        // Chronological: three wins, loss, two wins, with ignored results between them.
        const results = ['win', 'aborted', 'win', 'draw-agreement', 'win', 'loss', 'win', 'terminated', 'win', 'aborted', 'draw-agreement'];
        await collection.insertMany(results.map((result, index) => ({
            id: String(index), finishedAt: index + 1,
            players: [{ profileId: 'profile', playerId: 'player' }],
            gameOptions: { rated: true }, moves: [], moveCount: 0,
            gameResult: {
                reason: result === 'win' || result === 'loss' ? 'six-in-a-row' : result,
                winningPlayerId: result === 'win' ? 'player' : result === 'loss' ? 'opponent' : null,
                durationMs: 1000,
            },
        })));
        const stats = await repository.getPlayerProfileStatistics('profile');
        assert.equal(stats.currentRankedWinStreak, 2);
        assert.equal(stats.longestRankedWinStreak, 3);
        assert.equal(stats.totalGamesPlayed, results.length);
        await collection.deleteMany({ 'gameResult.winningPlayerId': { $ne: null } });
        const ignoredOnly = await repository.getPlayerProfileStatistics('profile');
        assert.equal(ignoredOnly.currentRankedWinStreak, 0);
        assert.equal(ignoredOnly.longestRankedWinStreak, 0);
    } finally {
        await client.close();
        await server.stop();
    }
});
