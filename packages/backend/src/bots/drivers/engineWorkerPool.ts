import { Worker } from 'node:worker_threads';

import type { BotEngineSuggestionResult, GameState, HexCoordinate } from '@ih3t/shared';
import type { Logger } from 'pino';

import type { EngineName } from './engineCatalogue';
import type { EngineWorkerRequest, EngineWorkerResponse } from './engineWorker';

export type EngineTurnSuggestion = BotEngineSuggestionResult<[HexCoordinate, HexCoordinate]>;

export type EngineWorkerPoolOptions = {
    /** Workers, and therefore thinks, in flight at once. One per concurrent game. */
    size: number;
    /** Wall-clock slack past the engine's own budget before a worker is given up on. */
    graceMs: number;
    entry: URL;
};

/** A think that never came back: the worker was killed and the caller must not wait. */
export class EngineWorkerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = `EngineWorkerError`;
    }
}

type Pending = {
    id: number;
    resolve: (result: EngineTurnSuggestion) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
};

type PooledWorker = {
    worker: Worker;
    pending: Pending | null;
    dead: boolean;
};

const DEFAULT_GRACE_MS = 1_000;

/** Under tsx the neighbour is the source; in the bundle it is the second build entry. */
export function resolveEngineWorkerEntry(): URL {
    const here = import.meta.url;
    return new URL(here.endsWith(`.ts`) ? `./engineWorker.ts` : `./engineWorker.cjs`, here);
}

/**
 * Runs engine thinks off the event loop. Sized to the concurrent-game cap so a game's
 * think never waits on another game's; a worker that overruns its budget or dies is
 * dropped, its caller told, and its slot re-spawned on demand.
 */
export class EngineWorkerPool {
    private readonly logger: Logger;
    private readonly options: EngineWorkerPoolOptions;
    private readonly workers = new Set<PooledWorker>();
    private readonly idle: PooledWorker[] = [];
    private readonly waiters: Array<{ resolve: (worker: PooledWorker) => void, reject: (error: Error) => void }> = [];
    private nextRequestId = 1;
    private closed = false;

    constructor(rootLogger: Logger, options: Partial<EngineWorkerPoolOptions> & Pick<EngineWorkerPoolOptions, `size`>) {
        this.logger = rootLogger.child({ component: `engine-worker-pool` });
        this.options = {
            size: Math.max(1, options.size),
            graceMs: options.graceMs ?? DEFAULT_GRACE_MS,
            entry: options.entry ?? resolveEngineWorkerEntry(),
        };
    }

    get size(): number {
        return this.options.size;
    }

    get isShutDown(): boolean {
        return this.closed;
    }

    /** Workers alive right now, spawned or busy; a test's window into the pool. */
    get activeWorkers(): number {
        return this.workers.size;
    }

    async suggestTurn(engine: EngineName, gameState: GameState, timeoutMs: number): Promise<EngineTurnSuggestion> {
        if (this.closed) {
            throw new EngineWorkerError(`The engine pool is shut down.`);
        }

        const pooled = await this.acquire();
        try {
            return await this.request(pooled, { id: this.nextRequestId++, engine, gameState, timeoutMs });
        } finally {
            this.release(pooled);
        }
    }

    async shutdown(): Promise<void> {
        this.closed = true;
        for (const waiter of this.waiters.splice(0)) {
            waiter.reject(new EngineWorkerError(`The engine pool is shut down.`));
        }

        await Promise.all([...this.workers].map((pooled) => {
            this.fail(pooled, new EngineWorkerError(`The engine pool is shut down.`));
            return pooled.worker.terminate();
        }));
    }

    private acquire(): Promise<PooledWorker> {
        const idle = this.idle.pop();
        if (idle) {
            return Promise.resolve(idle);
        }

        if (this.workers.size < this.options.size) {
            return Promise.resolve(this.spawn());
        }

        /* By design a think never waits (one per game, one worker per game); a wait that
         * outlives the grace is a bug surfacing, and the caller must not hang on it. */
        return new Promise((resolve, reject) => {
            const waiter = {
                resolve: (worker: PooledWorker) => {
                    clearTimeout(timer);
                    resolve(worker);
                },
                reject: (error: Error) => {
                    clearTimeout(timer);
                    reject(error);
                },
            };
            const timer = setTimeout(() => {
                const index = this.waiters.indexOf(waiter);
                if (index >= 0) {
                    this.waiters.splice(index, 1);
                }

                waiter.reject(new EngineWorkerError(`No engine worker became free within ${this.options.graceMs} ms.`));
            }, this.options.graceMs);
            this.waiters.push(waiter);
        });
    }

    private release(pooled: PooledWorker): void {
        if (pooled.dead || this.closed) {
            return;
        }

        const waiter = this.waiters.shift();
        if (waiter) {
            waiter.resolve(pooled);
            return;
        }

        this.idle.push(pooled);
    }

    private spawn(): PooledWorker {
        const worker = new Worker(this.options.entry, { stdout: true, stderr: true });
        const pooled: PooledWorker = { worker, pending: null, dead: false };
        this.workers.add(pooled);

        /* Engine chatter is debug output here, never the server's stdout. */
        worker.stdout.on(`data`, (chunk: Buffer) => this.logger.debug({ event: `bots.engine.stdout` }, chunk.toString().trim()));
        worker.stderr.on(`data`, (chunk: Buffer) => this.logger.warn({ event: `bots.engine.stderr` }, chunk.toString().trim()));
        worker.on(`message`, (response: EngineWorkerResponse) => this.settle(pooled, response));
        worker.on(`error`, (error: unknown) => {
            this.logger.error({ err: error, event: `bots.engine.worker.error` }, `Engine worker errored`);
            this.fail(pooled, new EngineWorkerError(error instanceof Error ? error.message : `The engine worker crashed.`));
        });
        worker.on(`exit`, (code) => {
            this.fail(pooled, new EngineWorkerError(`The engine worker exited with code ${code}.`));
            this.drop(pooled);
        });

        return pooled;
    }

    private request(pooled: PooledWorker, request: EngineWorkerRequest): Promise<EngineTurnSuggestion> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.logger.warn(
                    { event: `bots.engine.worker.timeout`, engine: request.engine, timeoutMs: request.timeoutMs },
                    `Engine worker overran its budget; terminating it`,
                );
                this.fail(pooled, new EngineWorkerError(`The engine did not answer within ${request.timeoutMs + this.options.graceMs} ms.`));
                /* `terminate` stops the thread even inside synchronous wasm; `exit` then drops it. */
                void pooled.worker.terminate();
            }, request.timeoutMs + this.options.graceMs);

            pooled.pending = { id: request.id, resolve, reject, timer };
            pooled.worker.postMessage(request);
        });
    }

    private settle(pooled: PooledWorker, response: EngineWorkerResponse): void {
        const pending = pooled.pending;
        if (!pending || pending.id !== response.id) {
            return;
        }

        clearTimeout(pending.timer);
        pooled.pending = null;
        if (`error` in response) {
            pending.reject(new EngineWorkerError(response.error));
            return;
        }

        pending.resolve(response.result);
    }

    /** Ends the in-flight request, if any, and retires the worker from the pool. */
    private fail(pooled: PooledWorker, error: Error): void {
        pooled.dead = true;
        const pending = pooled.pending;
        if (pending) {
            clearTimeout(pending.timer);
            pooled.pending = null;
            pending.reject(error);
        }

        const idleIndex = this.idle.indexOf(pooled);
        if (idleIndex >= 0) {
            this.idle.splice(idleIndex, 1);
        }
    }

    private drop(pooled: PooledWorker): void {
        this.workers.delete(pooled);
        /* A waiter was counting on this slot: give it a fresh worker rather than a wait. */
        const waiter = this.closed ? undefined : this.waiters.shift();
        if (waiter) {
            waiter.resolve(this.spawn());
        }
    }
}
