import { parentPort } from 'node:worker_threads';

import type { EngineWorkerRequest, EngineWorkerResponse } from './engineWorker';

/**
 * A stand-in for `engineWorker.ts` in the pool's and driver's tests: `seal` answers
 * after `timeoutMs` milliseconds, `dummy` spins forever like a wasm search that never
 * returns, and `timeoutMs` of minus two dies.
 */
parentPort?.on(`message`, (request: EngineWorkerRequest) => {
    if (request.engine === `dummy` || request.timeoutMs === -1) {
        for (;;) { /* synchronous, like the engine */ }
    }

    if (request.timeoutMs === -2) {
        process.exit(3);
    }

    const response: EngineWorkerResponse = {
        id: request.id,
        result: { status: `provide`, suggestion: [{ x: 1, y: 0 }, { x: 2, y: 0 }], metadata: { engine: request.engine } },
    };
    setTimeout(() => parentPort?.postMessage(response), request.timeoutMs);
});
