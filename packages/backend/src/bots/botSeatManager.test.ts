import 'reflect-metadata';

import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import pino from 'pino';

import { BOT_SEAT_FINISHED_GRACE_MS, type BotSeat, type BotSeatDriver, BotSeatManager } from './botSeatManager';
import {
    BOT_PROFILE_ID,
    BOT_SEAT,
    createTestSessionManager,
    HUMAN_SEAT,
    seedGame,
    sessionsOf,
    settle,
    teardownGame,
} from './botTestFixtures';

type Call = { hook: `start` | `turn` | `finish` | `rematch`, seat: BotSeat, cells?: number, expiresInMs?: number | null, reason?: string };

class RecordingDriver implements BotSeatDriver {
    readonly calls: Call[] = [];
    acceptsRematch = true;

    constructor(readonly type: `engine` | `stream`) { }

    onRematchRequested(seat: BotSeat): boolean {
        this.calls.push({ hook: `rematch`, seat });
        return this.acceptsRematch;
    }

    onStart(seat: BotSeat): void {
        this.calls.push({ hook: `start`, seat });
    }

    onTurn(seat: BotSeat, state: { cells: unknown[] }, clock: { expiresInMs: number | null }): void {
        this.calls.push({ hook: `turn`, seat, cells: state.cells.length, expiresInMs: clock.expiresInMs });
    }

    onFinish(seat: BotSeat, reason: string): void {
        this.calls.push({ hook: `finish`, seat, reason });
    }

    hooks(): string[] {
        return this.calls.map((call) => call.hook);
    }
}

type Fixture = { manager: BotSeatManager, driver: RecordingDriver, sessionManager: ReturnType<typeof createTestSessionManager> };

function withManager(name: string, body: (fixture: Fixture, t: TestContext) => Promise<void>): void {
    test(name, async (t) => {
        const sessionManager = createTestSessionManager();
        const manager = new BotSeatManager(pino({ level: `silent` }), sessionManager);
        const driver = new RecordingDriver(`engine`);
        manager.registerDriver(driver);
        manager.assignDriver(BOT_PROFILE_ID, `engine`);
        manager.attach();

        try {
            await body({ manager, driver, sessionManager }, t);
        } finally {
            manager.detach();
            for (const session of sessionsOf(sessionManager).values()) {
                teardownGame(sessionManager, session);
            }
        }
    });
}

withManager(`the bot moving first gets the origin placed for it, then one turn request`, async ({ manager, driver, sessionManager }) => {
    const session = seedGame(sessionManager, { botMovesFirst: true });
    manager.reconcile(session.id);
    await settle();

    assert.deepEqual(session.gameState.cells.map((cell) => [cell.x, cell.y, cell.occupiedBy]), [[0, 0, BOT_SEAT]]);
    assert.equal(session.gameState.currentTurnPlayerId, HUMAN_SEAT, `the origin completes the bot's opening turn`);
    assert.deepEqual(driver.hooks(), [`start`], `no turn is requested for a one-stone opening`);
    assert.deepEqual(driver.calls[0]?.seat, { sessionId: session.id, gameId: `game-abc`, seatId: BOT_SEAT, botProfileId: BOT_PROFILE_ID });
});

withManager(`the human's turn completing hands the bot exactly one turn request`, async ({ manager, driver, sessionManager }) => {
    const session = seedGame(sessionManager);
    manager.reconcile(session.id);
    await sessionManager.placeCell(session, HUMAN_SEAT, { x: 0, y: 0 });
    await settle();

    assert.deepEqual(driver.hooks(), [`start`, `turn`]);
    assert.equal(driver.calls[1]?.cells, 1);
    assert.ok((driver.calls[1]?.expiresInMs ?? 0) > 40_000, `the clock reaches the driver`);

    /* A second look at the same position asks nothing new. */
    manager.reconcile(session.id);
    assert.deepEqual(driver.hooks(), [`start`, `turn`]);
});

withManager(`a finished game tells the driver once, with the reason`, async ({ manager, driver, sessionManager }) => {
    const session = seedGame(sessionManager);
    manager.reconcile(session.id);
    await sessionManager.surrenderSession(session, HUMAN_SEAT);
    await settle();

    assert.deepEqual(driver.hooks(), [`start`, `finish`]);
    assert.equal(driver.calls[1]?.reason, `surrender`);
    manager.reconcile(session.id);
    assert.deepEqual(driver.hooks(), [`start`, `finish`], `a finished session is never re-tracked`);
});

withManager(`a session that vanishes without finishing reads as aborted`, async ({ manager, driver, sessionManager }) => {
    const session = seedGame(sessionManager);
    manager.reconcile(session.id);
    sessionsOf(sessionManager).delete(session.id);
    (manager as unknown as { abortIfVanished(id: string): void }).abortIfVanished(session.id);

    assert.deepEqual(driver.hooks(), [`start`, `finish`]);
    assert.equal(driver.calls[1]?.reason, `aborted`);
});

withManager(`replay forgets what the bot was told and tells it again`, async ({ manager, driver, sessionManager }) => {
    const session = seedGame(sessionManager);
    manager.reconcile(session.id);
    await sessionManager.placeCell(session, HUMAN_SEAT, { x: 0, y: 0 });
    await settle();
    manager.replay(BOT_PROFILE_ID);

    assert.deepEqual(driver.hooks(), [`start`, `turn`, `start`, `turn`]);
});

withManager(`a bot no driver claims is left to the stream driver`, async ({ manager, driver, sessionManager }) => {
    const session = seedGame(sessionManager, { botMovesFirst: true });
    const stream = new RecordingDriver(`stream`);
    manager.registerDriver(stream);
    manager.assignDriver(BOT_PROFILE_ID, `stream`);
    manager.reconcile(session.id);
    await settle();

    assert.equal(manager.getDriverType(`someone-else`), `stream`);
    assert.deepEqual(driver.hooks(), []);
    assert.deepEqual(stream.hooks(), [`start`]);
    assert.equal(session.gameState.cells.length, 1, `the origin is the manager's job whatever the driver`);
});

function botConnection(session: { players: { id: string, connection: { status: string } }[] }): string {
    return session.players.find((player) => player.id === BOT_SEAT)!.connection.status;
}

withManager(`a finished game keeps the bot seated while its human is still on the result screen`, async ({ manager, sessionManager }) => {
    const session = seedGame(sessionManager);
    manager.reconcile(session.id);
    await sessionManager.surrenderSession(session, HUMAN_SEAT);
    await settle();

    assert.equal(session.state, `finished`);
    assert.equal(botConnection(session), `connected`);
    assert.equal(sessionManager.getSession(session.id), session);
});

withManager(`the bot seat leaves a finished game once its last human is gone`, async ({ manager, sessionManager }) => {
    const session = seedGame(sessionManager);
    manager.reconcile(session.id);
    await sessionManager.surrenderSession(session, HUMAN_SEAT);
    await settle();

    sessionManager.handleSocketDisconnect(`socket-human`);
    await settle();

    assert.equal(botConnection(session), `disconnected`);
    assert.equal(sessionManager.getSession(session.id), null, `nothing pins the session once the bot has left`);
});

withManager(`a spectator keeps the bot seated, but only for the grace period`, async ({ manager, sessionManager }, t) => {
    t.mock.timers.enable({ apis: [`setTimeout`] });
    const session = seedGame(sessionManager);
    session.spectators.push({ id: `seat-spectator`, profileId: null, displayName: `Watcher`, socketId: `socket-spectator` });
    manager.reconcile(session.id);
    await sessionManager.surrenderSession(session, HUMAN_SEAT);
    await settle();
    sessionManager.handleSocketDisconnect(`socket-human`);
    await settle();

    assert.equal(botConnection(session), `connected`, `the spectator is still watching`);
    t.mock.timers.tick(BOT_SEAT_FINISHED_GRACE_MS - 1);
    await settle();
    assert.equal(botConnection(session), `connected`);

    t.mock.timers.tick(1);
    await settle();
    assert.equal(botConnection(session), `disconnected`);
    assert.equal(sessionManager.getSession(session.id), null);
});

withManager(`a human's rematch request goes to the driver, and an accepting seat is back in the new game`, async ({ driver, manager, sessionManager }) => {
    const session = seedGame(sessionManager);
    manager.reconcile(session.id);
    await sessionManager.placeCell(session, HUMAN_SEAT, { x: 0, y: 0 });
    await sessionManager.surrenderSession(session, HUMAN_SEAT);
    await settle();

    await sessionManager.requestRematch(session, HUMAN_SEAT);
    await settle();

    assert.deepEqual(driver.hooks(), [`start`, `turn`, `finish`, `rematch`]);
    assert.equal(driver.calls[3]?.seat.seatId, BOT_SEAT);
    const rematch = sessionManager.requireSession(session.id);
    assert.notEqual(rematch, session, `the rematch is a fresh session under the same id`);
    assert.equal(rematch.state, `lobby`);
    const botSeat = rematch.players.find((player) => player.isBot);
    assert.ok(botSeat && botSeat.id !== BOT_SEAT);
    assert.equal(botSeat.connection.status === `connected` && botSeat.connection.socketId, `bot:${BOT_PROFILE_ID}`);
    assert.equal(botSeat.displayName, `SealBot`);

    /* The gateway reseats the human; the game starts and the bot opens it, as the loser of the last opening. */
    const humanSeat = rematch.players.find((player) => !player.isBot)!;
    sessionManager.assignParticipantSocket(rematch, humanSeat.id, `socket-human`);
    await sessionManager.tickAllSessions();
    await settle();

    assert.equal(rematch.state, `in-game`);
    assert.deepEqual(driver.hooks(), [`start`, `turn`, `finish`, `rematch`, `start`]);
    assert.equal(driver.calls[4]?.seat.seatId, botSeat.id);
    assert.deepEqual(rematch.gameState.cells.map((cell) => cell.occupiedBy), [botSeat.id]);
});

withManager(`a driver that declines a rematch leaves the seat, so the human is told at once`, async ({ driver, manager, sessionManager }) => {
    driver.acceptsRematch = false;
    const session = seedGame(sessionManager);
    manager.reconcile(session.id);
    await sessionManager.surrenderSession(session, HUMAN_SEAT);
    await settle();

    await sessionManager.requestRematch(session, HUMAN_SEAT);
    await settle();

    assert.deepEqual(driver.hooks(), [`start`, `finish`, `rematch`]);
    assert.equal(sessionManager.getSession(session.id), session, `the human is still on the result screen`);
    assert.equal(botConnection(session), `disconnected`);
    assert.deepEqual(session.rematchAcceptedPlayerIds, []);
});

withManager(`a seat without the hook is treated as declining`, async ({ manager, sessionManager }) => {
    const session = seedGame(sessionManager, { botMovesFirst: true });
    const stream = new RecordingDriver(`stream`);
    (stream as { onRematchRequested?: unknown }).onRematchRequested = undefined;
    manager.registerDriver(stream);
    manager.assignDriver(BOT_PROFILE_ID, `stream`);
    manager.reconcile(session.id);
    await sessionManager.surrenderSession(session, HUMAN_SEAT);
    await settle();

    await sessionManager.requestRematch(session, HUMAN_SEAT);
    await settle();

    assert.equal(botConnection(session), `disconnected`);
});
