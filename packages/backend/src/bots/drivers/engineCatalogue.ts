import type { HouseBotStrengthPreset } from '@ih3t/shared';

export type EngineProfile = {
    /* The one strength knob `BotEngineInterface.suggestTurn` has, bounded for a custom pick. */
    thinkMs: { min: number, max: number, default: number };
    presets: readonly HouseBotStrengthPreset[];
};

/**
 * What each engine can do, in one place: the dialog renders it, the lobby route
 * validates against it, and a new engine is an entry here plus its factory in
 * `engineWorker.ts` (the record there is keyed by this one, so a missing factory
 * fails to type-check). SealBot's search is time-bound, so a preset is a think time
 * with a name; measured on a middlegame it reaches depth 3 at 50 ms, 4 at 300 ms and
 * 5 at 2 s.
 */
export const ENGINE_CATALOGUE = {
    seal: {
        thinkMs: { min: 10, max: 5_000, default: 300 },
        presets: [
            { id: `beginner`, thinkMs: 10 },
            { id: `easy`, thinkMs: 100 },
            { id: `medium`, thinkMs: 300 },
            { id: `hard`, thinkMs: 500 },
            { id: `expert`, thinkMs: 1_000 },
        ],
    },
    dummy: {
        thinkMs: { min: 0, max: 0, default: 0 },
        presets: [],
    },
} as const satisfies Record<string, EngineProfile>;

export type EngineName = keyof typeof ENGINE_CATALOGUE;

export function isEngineName(value: string): value is EngineName {
    return Object.hasOwn(ENGINE_CATALOGUE, value);
}
