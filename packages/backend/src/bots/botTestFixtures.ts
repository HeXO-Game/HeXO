import { type SessionId } from '@ih3t/shared';
import pino from 'pino';

import type { AccountUserProfile } from '../auth/authRepository';
import { SessionManager } from '../session/sessionManager';
import { createGameSession, type ServerGameSession } from '../session/types';
import { GameSimulation } from '../simulation/gameSimulation';
import { GameTimeControlManager } from '../simulation/gameTimeControlManager';

/** Shared by the bot suites: a real SessionManager over stubbed persistence. */
export const BOT_PROFILE_ID = `bot-1`;
export const HUMAN_PROFILE_ID = `human-1`;
export const BOT_SEAT = `seat-bot`;
export const HUMAN_SEAT = `seat-human`;
export const TURN_TIME_MS = 45_000;

export const HUMAN_PROFILE: AccountUserProfile = {
    id: HUMAN_PROFILE_ID,
    username: `Timmy`,
    email: null,
    image: null,
    role: `user`,
    kind: `human`,
    permissions: [],
    registeredAt: 0,
    lastActiveAt: 0,
};

export function botProfile(id: string = BOT_PROFILE_ID, username: string = id): AccountUserProfile {
    return { ...HUMAN_PROFILE, id, username, kind: `bot` };
}

export function createTestSessionManager(): SessionManager {
    const gameHistoryRepository = {
        appendMoves: () => Promise.resolve(),
        finishGame: () => Promise.resolve(),
        createGame: () => Promise.resolve(`game-abc`),
    };

    return new SessionManager(
        pino({ level: `silent` }),
        { createShutdownHook: () => ({ tryShutdown: () => { } }), isShutdownPending: () => false } as never,
        new GameSimulation(),
        new GameTimeControlManager(),
        { getPlayerRating: () => Promise.resolve({ eloScore: 1_000, gameCount: 0 }) } as never,
        gameHistoryRepository as never,
        { track: () => { } } as never,
        { getSettings: () => ({ maxConcurrentGames: null }) } as never,
    );
}

export function sessionsOf(sessionManager: SessionManager): Map<string, ServerGameSession> {
    return (sessionManager as unknown as { sessions: Map<string, ServerGameSession> }).sessions;
}

export type SeedOptions = {
    botMovesFirst?: boolean;
    sessionId?: string;
    timeControl?: ServerGameSession[`gameOptions`][`timeControl`];
};

/** One in-game session, human and bot seated and connected, the clock read but never fired. */
export function seedGame(sessionManager: SessionManager, options: SeedOptions = {}): ServerGameSession {
    const sessionId = (options.sessionId ?? `bot-session`) as SessionId;
    const session = createGameSession(sessionId, {
        visibility: `private`,
        rated: false,
        timeControl: options.timeControl ?? { mode: `turn`, turnTimeMs: TURN_TIME_MS },
        firstPlayer: `host`,
    });

    session.players.push({
        id: HUMAN_SEAT,
        deviceId: `device-human`,
        profileId: HUMAN_PROFILE_ID,
        displayName: `Timmy`,
        rating: { eloScore: 1_240, gameCount: 0 },
        ratingAdjustment: null,
        ratingAdjusted: null,
        isBot: false,
        connection: { status: `connected`, socketId: `socket-human` },
    });
    session.players.push({
        id: BOT_SEAT,
        deviceId: `bot:${BOT_PROFILE_ID}`,
        profileId: BOT_PROFILE_ID,
        displayName: `SealBot`,
        rating: { eloScore: 1_500, gameCount: 0 },
        ratingAdjustment: null,
        ratingAdjusted: null,
        isBot: true,
        connection: { status: `connected`, socketId: `bot:${BOT_PROFILE_ID}` },
    });

    session.state = `in-game`;
    session.startedAt = Date.now();
    session.gameId = `game-abc`;
    new GameSimulation().startSession(
        session.gameState,
        [HUMAN_SEAT, BOT_SEAT],
        options.botMovesFirst ? BOT_SEAT : HUMAN_SEAT,
    );
    if (session.gameOptions.timeControl.mode !== `unlimited`) {
        session.currentTurnExpiresAt = session.startedAt + TURN_TIME_MS;
    }

    sessionsOf(sessionManager).set(sessionId, session);
    return session;
}

/** Releases what a seeded game would otherwise hold the test process open with. */
export function teardownGame(sessionManager: SessionManager, session: ServerGameSession): void {
    (sessionManager as unknown as { timeControl: { dispose: () => void } }).timeControl.dispose();
    for (const player of session.players) {
        if (player.connection.status === `orphaned`) {
            clearTimeout(player.connection.timeout);
        }
    }
}

export async function settle(): Promise<void> {
    for (let index = 0; index < 5; index += 1) {
        await new Promise((resolve) => setImmediate(resolve));
    }
}
