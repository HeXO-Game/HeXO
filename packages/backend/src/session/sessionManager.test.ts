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

test(`aborting a tournament game forfeits it instead of restarting the pairing`, async () => {
    const sessionManager = createSessionManager({ finishGame: async () => {} } as never);
    const sessionId = `session-tournament-abort` as SessionId;
    const session = createGameSession(sessionId, {
        visibility: `private`,
        rated: false,
        timeControl: { mode: `unlimited` },
        firstPlayer: `host`,
    }, {
        tournament: { tournamentId: `tournament-1`, matchId: `match-swiss-1-1` } as never,
    });
    session.players = [
        { id: `aborting-player`, profileId: `profile-a`, connection: { status: `connected`, socketId: `socket-a` } },
        { id: `opponent`, profileId: `profile-b`, connection: { status: `connected`, socketId: `socket-b` } },
    ] as never;
    session.state = `in-game`;
    session.startedAt = Date.now() - 1_000;
    session.gameId = `game-tournament-abort`;

    (sessionManager as unknown as {
        sessions: Map<string, ServerGameSession>;
    }).sessions.set(sessionId, session);

    await sessionManager.abortSession(session, `aborting-player`);

    assert.equal(session.state, `finished`);
    assert.equal(session.finishReason, `surrender`);
    assert.equal(session.winningPlayerId, `opponent`);
});

function createTournamentSession(sessionManager: SessionManager, sessionId: SessionId, tournament: Record<string, unknown>): ServerGameSession {
    const session = createGameSession(sessionId, {
        visibility: `private`,
        rated: false,
        timeControl: { mode: `unlimited` },
        firstPlayer: `host`,
    }, {
        tournament: { tournamentId: `tournament-1`, matchId: `match-1`, matchJoinDeadlineAt: null, matchOutcome: null, ...tournament } as never,
    });
    (sessionManager as unknown as {
        sessions: Map<string, ServerGameSession>;
    }).sessions.set(sessionId, session);
    return session;
}

test(`tournament join countdown is measured when the session is sent, not when it was created`, () => {
    const sessionManager = createSessionManager({ finishGame: async () => {} } as never);
    const sessionId = `session-late-join` as SessionId;
    createTournamentSession(sessionManager, sessionId, {
        // Snapshot taken when the lobby was created: the full five minutes.
        matchJoinTimeoutInMs: 300_000,
        matchJoinDeadlineAt: Date.now() + 120_000,
    });

    const remaining = sessionManager.getSessionInfo(sessionId)?.tournament?.matchJoinTimeoutInMs ?? 0;
    assert.ok(remaining <= 120_000 && remaining > 115_000, `expected about two minutes left, got ${remaining}`);
});

test(`closing a tournament match ends a game that is still being played`, async () => {
    const sessionManager = createSessionManager({ finishGame: async () => {} } as never);
    const sessionId = `session-closed-match` as SessionId;
    const session = createTournamentSession(sessionManager, sessionId, {});
    session.state = `in-game`;
    session.startedAt = Date.now() - 1_000;
    session.gameId = `game-closed-match`;

    sessionManager.closeTournamentMatchSession(sessionId, { kind: `resolved`, resultType: `walkover`, winnerProfileId: `profile-a` });
    await session.lock.runExclusive(async () => {});

    assert.deepEqual(session.tournament?.matchOutcome, { kind: `resolved`, resultType: `walkover`, winnerProfileId: `profile-a` });
    assert.equal(session.state, `finished`);
    assert.equal(session.finishReason, `terminated`);
});

test(`a tournament lobby whose match was decided does not start a game when both players arrive`, async () => {
    const sessionManager = createSessionManager({ finishGame: async () => {} } as never);
    const sessionId = `session-decided-match` as SessionId;
    const session = createTournamentSession(sessionManager, sessionId, {
        matchOutcome: { kind: `resolved`, resultType: `walkover`, winnerProfileId: `profile-a` },
    });
    session.players = [
        { id: `winner`, profileId: `profile-a`, connection: { status: `connected`, socketId: `socket-a` } },
        { id: `late-opponent`, profileId: `profile-b`, connection: { status: `connected`, socketId: `socket-b` } },
    ] as never;

    await (sessionManager as unknown as { tickSession: (session: ServerGameSession) => Promise<void> }).tickSession(session);

    assert.equal(session.state, `lobby`);
});
