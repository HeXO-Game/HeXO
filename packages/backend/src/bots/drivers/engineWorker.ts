import { parentPort } from 'node:worker_threads';

import createDummyEngine from '@ih3t/bot-engine-dummy';
import createSealEngine from '@ih3t/bot-engine-seal';
import type { BotEngineInterface, BotEngineSuggestionResult, GameState, HexCoordinate } from '@ih3t/shared';

import type { EngineName } from './engineCatalogue';

/**
 * The worker side of `EngineWorkerPool`: one request in flight at a time, one engine
 * instance per kind, kept for the life of the worker. SealBot's `getMove` is
 * synchronous wasm that blocks for its whole budget, which is why this runs here and
 * not on the server's event loop.
 */
export type EngineWorkerRequest = {
    id: number;
    engine: EngineName;
    gameState: GameState;
    timeoutMs: number;
};

export type EngineWorkerResponse =
    | { id: number, result: BotEngineSuggestionResult<[HexCoordinate, HexCoordinate]> }
    | { id: number, error: string };

const factories: Record<EngineName, () => Promise<BotEngineInterface>> = {
    seal: createSealEngine,
    dummy: createDummyEngine,
};

const engines = new Map<EngineName, Promise<BotEngineInterface>>();

function getEngine(name: EngineName): Promise<BotEngineInterface> {
    let engine = engines.get(name);
    if (!engine) {
        engine = factories[name]().catch((error: unknown) => {
            /* A failed load is retried next time, not answered with the same error forever. */
            engines.delete(name);
            throw error;
        });
        engines.set(name, engine);
    }

    return engine;
}

async function handle(request: EngineWorkerRequest): Promise<EngineWorkerResponse> {
    try {
        const engine = await getEngine(request.engine);
        return { id: request.id, result: await engine.suggestTurn(request.gameState, request.timeoutMs) };
    } catch (error: unknown) {
        return { id: request.id, error: error instanceof Error ? error.message : `The engine failed.` };
    }
}

parentPort?.on(`message`, (request: EngineWorkerRequest) => {
    void handle(request).then((response) => parentPort?.postMessage(response));
});
