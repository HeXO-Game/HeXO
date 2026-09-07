import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyGameState } from '@ih3t/shared';
import { Mutex } from 'async-mutex';
import { SessionManager } from './sessionManager';
import { GameHistoryRepository } from '../persistence/gameHistoryRepository';
import type { ServerGameSession } from './types';

test('either player may abort through three placements, never later or as a spectator, without rating writes', async () => {
    let ratingCalls = 0;
    let savedReason: string | undefined;
    let savedAbortedBy: string | null | undefined;
    const manager: SessionManager = Object.assign(Object.create(SessionManager.prototype), {
        timeControl: { freezeActiveTurnState() {}, clearSession() {} },
        getClientGameState: (session: ServerGameSession) => session.gameState,
        applyRatingAdjustments: async () => { ratingCalls++; },
        ensureGameHistory: async () => 'game',
        gameHistoryRepository: { finishGame: async (_id: string, result: { reason: string; abortedByPlayerId?: string | null }) => { savedReason = result.reason; savedAbortedBy = result.abortedByPlayerId; } },
        metricsTracker: { track() {} },
        eventHandlers: {},
        emitSessionUpdated() {},
        shutdownHook: { tryShutdown() {} },
        logger: { info() {} },
        tickSession: async () => {},
    });
    const makeSession = (count: number) => ({
        id: 'session', lock: new Mutex(), state: 'in-game',
        createdAt: 0, startedAt: 0, isRatedGame: true,
        gameState: { ...createEmptyGameState(), cells: Array.from({ length: count }, (_, x) => ({ x, y: 0, occupiedBy: 'one' })) },
        players: ['one', 'two'].map(id => ({ id, ratingAdjustment: { eloGain: 10, eloLoss: -10 }, ratingAdjusted: null })),
        spectators: [],
    } as unknown as ServerGameSession);

    for (const player of ['one', 'two']) {
        for (const count of [0, 1, 2, 3]) {
            const session = makeSession(count);
            await manager.abortSession(session, player);
            assert.equal(session.state, 'finished');
            assert.equal(session.finishReason, 'aborted');
            assert.equal(session.winningPlayerId, null);
            assert.equal(savedReason, 'aborted');
            assert.equal(session.abortedByPlayerId, player);
            assert.equal(savedAbortedBy, player);
            assert.ok(session.players.every(player => player.ratingAdjustment === null));
            await assert.rejects(manager.abortSession(session, player), /not currently active/);
        }
        await assert.rejects(manager.abortSession(makeSession(4), player), /no longer be aborted/);
    }
    await assert.rejects(manager.abortSession(makeSession(0), 'spectator'), /Only active players/);
    const lobby = makeSession(0);
    lobby.state = 'lobby';
    await assert.rejects(manager.abortSession(lobby, 'one'), /not currently active/);
    assert.equal(ratingCalls, 0);
});

test('game history persists the player who aborted', async () => {
    let savedResult: unknown;
    const repository: GameHistoryRepository = Object.assign(Object.create(GameHistoryRepository.prototype), {
        getCollection: async () => ({
            updateOne: async (_filter: unknown, update: { $set: { gameResult: unknown } }) => {
                savedResult = update.$set.gameResult;
                return { matchedCount: 1 };
            },
        }),
    });
    const result = { reason: 'aborted' as const, winningPlayerId: null, abortedByPlayerId: 'two', durationMs: 1000 };
    await repository.finishGame('game', result);
    assert.deepEqual(savedResult, result);
});
