import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { type SessionId } from '@ih3t/shared';
import pino from 'pino';

import { GameSimulation } from '../simulation/gameSimulation';
import { GameTimeControlManager } from '../simulation/gameTimeControlManager';
import { SessionManager } from './sessionManager';
import { createGameSession, type ServerGameSession } from './types';

class DelayedGameHistoryRepository {
    private startResolver: () => void = () => {};
    private releaseResolver: () => void = () => {};
    readonly finishStarted = new Promise<void>((resolve) => {
        this.startResolver = resolve;
    });
    private readonly releaseFinish = new Promise<void>((resolve) => {
        this.releaseResolver = resolve;
    });
    finalized = false;

    release(): void {
        this.releaseResolver();
    }

    async finishGame(): Promise<void> {
        this.startResolver();
        await this.releaseFinish;
        this.finalized = true;
    }
}

function createSessionManager(gameHistoryRepository: DelayedGameHistoryRepository): SessionManager {
    const serverShutdownService = {
        createShutdownHook: () => ({ tryShutdown: () => {} }),
    };
    const metricsTracker = { track: () => {} };

    return new SessionManager(
        pino({ level: `silent` }),
        serverShutdownService as never,
        new GameSimulation(),
        new GameTimeControlManager(),
        {} as never,
        gameHistoryRepository as never,
        metricsTracker as never,
        {} as never,
    );
}

test(`finishing a session waits for its durable game result`, async () => {
    const gameHistoryRepository = new DelayedGameHistoryRepository();
    const sessionManager = createSessionManager(gameHistoryRepository);
    const sessionId = `session-persistence` as SessionId;
    const session = createGameSession(sessionId, {
        visibility: `private`,
        rated: false,
        timeControl: { mode: `unlimited` },
        firstPlayer: `host`,
    });
    session.state = `in-game`;
    session.startedAt = Date.now() - 1_000;
    session.gameId = `game-persistence`;

    (sessionManager as unknown as {
        sessions: Map<string, ServerGameSession>;
    }).sessions.set(sessionId, session);

    let finishResolved = false;
    const finishPromise = sessionManager.terminateActiveSession(sessionId).then((result) => {
        finishResolved = true;
        return result;
    });

    await gameHistoryRepository.finishStarted;
    await Promise.resolve();
    assert.equal(finishResolved, false);

    gameHistoryRepository.release();
    const finishedSession = await finishPromise;

    assert.equal(gameHistoryRepository.finalized, true);
    assert.equal(finishedSession.state.status, `finished`);
});
