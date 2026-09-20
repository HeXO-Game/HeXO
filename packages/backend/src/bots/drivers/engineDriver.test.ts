import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyGameState, zCellOccupant, type GameState, type HexCoordinate } from '@ih3t/shared';
import pino from 'pino';

import { BotSeatManager } from '../botSeatManager';
import {
    BOT_PROFILE_ID,
    BOT_SEAT,
    createTestSessionManager,
    HUMAN_SEAT,
    seedGame,
    sessionsOf,
    settle,
    teardownGame,
} from '../botTestFixtures';
import { budgetFor, EngineDriver, sanitizeTurn } from './engineDriver';
import { EngineWorkerError, EngineWorkerPool, type EngineTurnSuggestion } from './engineWorkerPool';

type ThinkCall = { engine: string, cells: number, timeoutMs: number };

class FakePool {
    readonly calls: ThinkCall[] = [];
    answer: (state: GameState) => EngineTurnSuggestion | Promise<EngineTurnSuggestion> = () => ({ status: `failure`, message: `unset`, metadata: {} });

    async suggestTurn(engine: string, state: GameState, timeoutMs: number): Promise<EngineTurnSuggestion> {
        this.calls.push({ engine, cells: state.cells.length, timeoutMs });
        return await this.answer(state);
    }
}

function provide(...cells: HexCoordinate[]): EngineTurnSuggestion {
    return { status: `provide`, suggestion: [cells[0]!, cells[1]!], metadata: {} };
}

function withDriver(
    name: string,
    body: (fixture: { driver: EngineDriver, pool: FakePool, manager: BotSeatManager, sessionManager: ReturnType<typeof createTestSessionManager> }) => Promise<void>,
): void {
    test(name, async () => {
        const sessionManager = createTestSessionManager();
        const pool = new FakePool();
        const driver = new EngineDriver(pino({ level: `silent` }), sessionManager, pool as unknown as EngineWorkerPool);
        const manager = new BotSeatManager(pino({ level: `silent` }), sessionManager);
        driver.registerBot(BOT_PROFILE_ID, `seal`);
        manager.registerDriver(driver);
        manager.assignDriver(BOT_PROFILE_ID, `engine`);
        manager.attach();

        try {
            await body({ driver, pool, manager, sessionManager });
        } finally {
            manager.detach();
            for (const session of sessionsOf(sessionManager).values()) {
                teardownGame(sessionManager, session);
            }
        }
    });
}

withDriver(`a turn request becomes a think in the pool and a whole turn on the board`, async ({ driver, pool, manager, sessionManager }) => {
    const session = seedGame(sessionManager);
    driver.configureSeat(session.id, { engine: `seal`, thinkMs: 300 });
    pool.answer = () => provide({ x: 1, y: 0 }, { x: 2, y: 0 });
    manager.reconcile(session.id);
    await sessionManager.placeCell(session, HUMAN_SEAT, { x: 0, y: 0 });
    await settle();

    assert.deepEqual(pool.calls, [{ engine: `seal`, cells: 1, timeoutMs: 300 }]);
    assert.deepEqual(session.gameState.cells.map((cell) => cell.occupiedBy), [HUMAN_SEAT, BOT_SEAT, BOT_SEAT]);
    assert.equal(session.gameState.currentTurnPlayerId, HUMAN_SEAT);
});

withDriver(`the think is capped by the clock and falls back to the catalogue default`, async ({ pool, manager, sessionManager }) => {
    const session = seedGame(sessionManager, { timeControl: { mode: `turn`, turnTimeMs: 600 } });
    session.currentTurnExpiresAt = Date.now() + 600;
    pool.answer = () => provide({ x: 1, y: 0 }, { x: 2, y: 0 });
    manager.reconcile(session.id);
    await sessionManager.placeCell(session, HUMAN_SEAT, { x: 0, y: 0 });
    await settle();

    assert.equal(pool.calls.length, 1);
    assert.ok(pool.calls[0]!.timeoutMs <= 100 && pool.calls[0]!.timeoutMs >= 10, `budget ${pool.calls[0]!.timeoutMs} respects the 500 ms margin`);
});

withDriver(`an illegal suggestion is completed with legal stones, never refused`, async ({ driver, pool, manager, sessionManager }) => {
    const session = seedGame(sessionManager);
    driver.configureSeat(session.id, { engine: `seal`, thinkMs: 100 });
    /* The first stone sits on the human's; the second is fine. */
    pool.answer = () => provide({ x: 0, y: 0 }, { x: 1, y: 0 });
    manager.reconcile(session.id);
    await sessionManager.placeCell(session, HUMAN_SEAT, { x: 0, y: 0 });
    await settle();

    assert.equal(session.gameState.cells.length, 3);
    assert.equal(session.gameState.currentTurnPlayerId, HUMAN_SEAT);
    assert.equal(session.state, `in-game`);
});

withDriver(`a think that fails resigns the seat instead of leaving it stuck`, async ({ driver, pool, manager, sessionManager }) => {
    const session = seedGame(sessionManager);
    driver.configureSeat(session.id, { engine: `seal`, thinkMs: 100 });
    pool.answer = () => { throw new EngineWorkerError(`killed`); };
    manager.reconcile(session.id);
    await sessionManager.placeCell(session, HUMAN_SEAT, { x: 0, y: 0 });
    await settle();

    assert.equal(session.state, `finished`);
    assert.equal(session.finishReason, `surrender`);
    assert.equal(session.winningPlayerId, HUMAN_SEAT);
    assert.deepEqual(driver.getSeatConfig(session.id), { engine: `seal`, thinkMs: 100 }, `the pinned strength outlives the game: a rematch reuses it`);

    sessionManager.handleSocketDisconnect(`socket-human`);
    await settle();
    assert.equal(sessionManager.getSession(session.id), null);
    assert.equal(driver.getSeatConfig(session.id), null, `and goes with the session`);
});

withDriver(`a rematch is taken and played at the pinned strength`, async ({ driver, pool, manager, sessionManager }) => {
    const session = seedGame(sessionManager);
    driver.configureSeat(session.id, { engine: `seal`, thinkMs: 1_000 });
    pool.answer = () => provide({ x: 1, y: 0 }, { x: 2, y: 0 });
    manager.reconcile(session.id);
    await sessionManager.placeCell(session, HUMAN_SEAT, { x: 0, y: 0 });
    await settle();
    await sessionManager.surrenderSession(session, HUMAN_SEAT);
    await settle();

    await sessionManager.requestRematch(session, HUMAN_SEAT);
    await settle();
    const rematch = sessionManager.requireSession(session.id);
    assert.notEqual(rematch, session);
    const humanSeat = rematch.players.find((player) => !player.isBot)!;
    const botSeat = rematch.players.find((player) => player.isBot)!;
    sessionManager.assignParticipantSocket(rematch, humanSeat.id, `socket-human`);
    await sessionManager.tickAllSessions();
    await settle();

    /* The bot opened (origin for free), the human answered, the bot thinks again at 1 s. */
    assert.equal(rematch.state, `in-game`);
    assert.equal(rematch.gameState.currentTurnPlayerId, humanSeat.id);
    await sessionManager.placeCells(rematch, humanSeat.id, [{ x: 1, y: 0 }, { x: 0, y: 1 }]);
    await settle();

    assert.deepEqual(pool.calls.map((call) => call.timeoutMs), [1_000, 1_000]);
    assert.equal(rematch.gameState.cells.length, 5);
    assert.equal(rematch.gameState.cells.filter((cell) => cell.occupiedBy === botSeat.id).length, 3);
});

withDriver(`two games think in parallel and each gets its own answer`, async ({ driver, pool, manager, sessionManager }) => {
    const first = seedGame(sessionManager, { sessionId: `game-1` });
    const second = seedGame(sessionManager, { sessionId: `game-2` });
    driver.configureSeat(first.id, { engine: `seal`, thinkMs: 1_000 });
    driver.configureSeat(second.id, { engine: `seal`, thinkMs: 10 });
    let release: () => void = () => { };
    const gate = new Promise<void>((resolve) => { release = resolve; });
    pool.answer = async () => {
        if (pool.calls.at(-1)?.timeoutMs === 1_000) {
            await gate;
        }

        return provide({ x: 1, y: 0 }, { x: 2, y: 0 });
    };
    manager.reconcile(first.id);
    manager.reconcile(second.id);
    await sessionManager.placeCell(first, HUMAN_SEAT, { x: 0, y: 0 });
    await sessionManager.placeCell(second, HUMAN_SEAT, { x: 0, y: 0 });
    await settle();

    assert.equal(second.gameState.cells.length, 3, `the quick game did not wait for the slow one`);
    assert.equal(first.gameState.cells.length, 1);
    release();
    await settle();
    assert.equal(first.gameState.cells.length, 3);
    assert.deepEqual(pool.calls.map((call) => call.timeoutMs).sort(), [10, 1_000]);
});

test(`budgetFor keeps the margin and the floor`, () => {
    assert.equal(budgetFor(300, null), 300);
    assert.equal(budgetFor(2_000, 1_200), 700);
    assert.equal(budgetFor(2_000, 400), 10);
    assert.equal(budgetFor(0, null), 10);
});

test(`sanitizeTurn keeps the legal prefix and fills the rest`, () => {
    const state = createEmptyGameState();
    state.playerTiles = { p1: { colorIndex: 0 }, p2: { colorIndex: 1 } };
    state.cells = [{ x: 0, y: 0, occupiedBy: zCellOccupant.parse(`p1`) }];
    state.currentTurnPlayerId = `p2`;
    state.placementsRemaining = 2;

    const completed = sanitizeTurn(state, `p2`, [{ x: 1, y: 0 }, { x: 1, y: 0 }]);
    assert.deepEqual(completed[0], { x: 1, y: 0 });
    assert.equal(completed.length, 2);
    assert.notDeepEqual(completed[1], { x: 1, y: 0 }, `the duplicate stone is replaced, not repeated`);
    assert.equal(sanitizeTurn(state, `p2`, []).length, 2);
    assert.deepEqual(sanitizeTurn(state, `p1`, [{ x: 1, y: 0 }]), [], `not this player's turn`);
});

test(`with a real pool, a hung worker resigns its game and the next game is still served`, async () => {
    const sessionManager = createTestSessionManager();
    const pool = new EngineWorkerPool(pino({ level: `silent` }), { size: 1, graceMs: 2_000, entry: new URL(`./engineWorker.fixture.ts`, import.meta.url) });
    const driver = new EngineDriver(pino({ level: `silent` }), sessionManager, pool);
    const manager = new BotSeatManager(pino({ level: `silent` }), sessionManager);
    driver.registerBot(BOT_PROFILE_ID, `seal`);
    manager.registerDriver(driver);
    manager.assignDriver(BOT_PROFILE_ID, `engine`);
    manager.attach();
    const hanging = seedGame(sessionManager, { sessionId: `hang` });
    const healthy = seedGame(sessionManager, { sessionId: `ok` });

    try {
        /* The fixture worker never answers a `dummy` think. */
        driver.configureSeat(hanging.id, { engine: `dummy`, thinkMs: 10 });
        driver.configureSeat(healthy.id, { engine: `seal`, thinkMs: 10 });
        manager.reconcile(hanging.id);
        await sessionManager.placeCell(hanging, HUMAN_SEAT, { x: 0, y: 0 });
        /* Completion, not a fixed sleep: under load, spawning the worker, the pool's
         * grace and the re-spawn can each take longer than any fixed budget. */
        await until(() => hanging.state === `finished`, `the hung worker's game resigns`);

        assert.equal(hanging.finishReason, `surrender`);
        assert.equal(hanging.winningPlayerId, HUMAN_SEAT);

        manager.reconcile(healthy.id);
        await sessionManager.placeCell(healthy, HUMAN_SEAT, { x: 0, y: 0 });
        await until(() => healthy.gameState.cells.length === 3, `a fresh worker serves the next think`);

        assert.equal(pool.activeWorkers, 1);
    } finally {
        manager.detach();
        await pool.shutdown();
        for (const session of sessionsOf(sessionManager).values()) {
            teardownGame(sessionManager, session);
        }
    }
});

/** Waits for a condition with a ceiling generous enough that only a real failure,
 * never machine load, reaches it. */
async function until(condition: () => boolean, what: string, ceilingMs = 10_000): Promise<void> {
    const deadline = Date.now() + ceilingMs;
    while (!condition()) {
        if (Date.now() >= deadline) {
            assert.fail(`${what} did not happen within ${ceilingMs} ms`);
        }

        await new Promise((resolve) => setTimeout(resolve, 25));
    }
}
