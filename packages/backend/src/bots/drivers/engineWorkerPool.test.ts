import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyGameState, zCellOccupant } from '@ih3t/shared';
import pino from 'pino';

import { EngineWorkerError, EngineWorkerPool } from './engineWorkerPool';

const FIXTURE = new URL(`./engineWorker.fixture.ts`, import.meta.url);

function createPool(size: number, graceMs = 5_000): EngineWorkerPool {
    /* The grace doubles as the spawn budget of the first worker, which machine load
     * can stretch far past any tight value — a generous one keeps every test here
     * about completion, never about wall clock. */
    return new EngineWorkerPool(pino({ level: `silent` }), { size, graceMs, entry: FIXTURE });
}

test(`a think comes back from the worker and the worker is reused`, async () => {
    const pool = createPool(2);
    try {
        const first = await pool.suggestTurn(`seal`, createEmptyGameState(), 5);
        const second = await pool.suggestTurn(`seal`, createEmptyGameState(), 5);

        assert.equal(first.status, `provide`);
        assert.equal(second.status, `provide`);
        assert.equal(pool.activeWorkers, 1, `a second sequential think reuses the idle worker`);
    } finally {
        await pool.shutdown();
    }
});

test(`a long think in one game never delays another game's think`, async () => {
    const pool = createPool(2, 5_000);
    try {
        /* Ordering, not a wall-clock bound: the slow think blocks for its whole 2 s
         * budget, so the fast one answering first is the pool parallelising, however
         * long a worker takes to spawn under load. */
        let slowSettled = false;
        const slow = pool.suggestTurn(`seal`, createEmptyGameState(), 2_000);
        void slow.then(() => { slowSettled = true; });
        const fast = await pool.suggestTurn(`seal`, createEmptyGameState(), 5);

        assert.equal(fast.status, `provide`);
        assert.ok(!slowSettled, `the fast think answered while the slow one was still running`);
        assert.equal((await slow).status, `provide`);
        assert.equal(pool.activeWorkers, 2);
    } finally {
        await pool.shutdown();
    }
});

test(`past the pool size a think waits for a free worker instead of spawning`, async () => {
    const pool = createPool(1, 5_000);
    try {
        const first = pool.suggestTurn(`seal`, createEmptyGameState(), 100);
        const second = pool.suggestTurn(`seal`, createEmptyGameState(), 5);
        assert.equal((await first).status, `provide`);
        assert.equal((await second).status, `provide`);
        assert.equal(pool.activeWorkers, 1);
    } finally {
        await pool.shutdown();
    }
});

test(`a worker stuck in a synchronous search is killed and the caller told`, async () => {
    const pool = createPool(1, 100);
    try {
        await assert.rejects(pool.suggestTurn(`seal`, createEmptyGameState(), -1), EngineWorkerError);
        /* No second think here on purpose: proving the freed slot serves a fresh
         * worker would race that worker's spawn against this pool's 100 ms guard,
         * which machine load loses. The dies test and the driver's real-pool test
         * cover a fresh worker under a real spawn budget. */
    } finally {
        await pool.shutdown();
    }
});

test(`a worker that dies rejects its think, and a waiter gets a fresh worker`, async () => {
    const pool = createPool(1, 5_000);
    try {
        const dying = pool.suggestTurn(`seal`, createEmptyGameState(), -2);
        const waiting = pool.suggestTurn(`seal`, createEmptyGameState(), 5);
        await assert.rejects(dying, EngineWorkerError);
        assert.equal((await waiting).status, `provide`);
    } finally {
        await pool.shutdown();
    }
});

test(`shutdown terminates every worker and refuses new thinks`, async () => {
    const pool = createPool(2, 5_000);
    const inFlight = pool.suggestTurn(`seal`, createEmptyGameState(), 5_000);
    await pool.shutdown();

    await assert.rejects(inFlight, EngineWorkerError);
    await assert.rejects(pool.suggestTurn(`seal`, createEmptyGameState(), 5), EngineWorkerError);
    assert.equal(pool.activeWorkers, 0);
});

test(`the real worker answers with the dummy engine`, async () => {
    const pool = new EngineWorkerPool(pino({ level: `silent` }), { size: 1, graceMs: 5_000 });
    try {
        const state = createEmptyGameState();
        state.playerTiles = { p1: { colorIndex: 0 }, p2: { colorIndex: 1 } };
        state.currentTurnPlayerId = `p1`;
        state.placementsRemaining = 2;
        state.cells = [{ x: 0, y: 0, occupiedBy: zCellOccupant.parse(`p2`) }];

        const result = await pool.suggestTurn(`dummy`, state, 50);
        assert.equal(result.status, `provide`);
        assert.equal(result.status === `provide` && result.suggestion.length, 2);
    } finally {
        await pool.shutdown();
    }
});
