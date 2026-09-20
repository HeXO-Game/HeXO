import type { EngineName } from './drivers/engineCatalogue';

export type HouseBotSeed = {
    key: string;
    username: string;
    /* Typed by the catalogue: a seed naming an engine the worker cannot run does not compile. */
    driver: { type: `engine`, engine: EngineName };
};

/**
 * What `HouseBotService.attach()` seeds (flag on, upsert by key) and what
 * `listHouseBots` orders by. One entry per house bot; a second engine is a second
 * line here, a catalogue entry, and a worker factory.
 */
export const HOUSE_BOT_SEEDS: readonly HouseBotSeed[] = [
    { key: `house:seal`, username: `SealBot`, driver: { type: `engine`, engine: `seal` } },
];
