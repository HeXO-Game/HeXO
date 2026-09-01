import type { BotEngineInterface } from '@ih3t/shared';
import React from 'react';
import { NavLink } from 'react-router';
import { Trans } from 'react-i18next';

import { WorkerBotClient, WorkerBotInterface } from './botWorkerClient';
import i18next from 'i18next'

export type SandboxBotEngineInfo = {
    name: string,
    displayName: string,
    description: () => React.ReactNode,
};

export const kSandboxBotEngines: readonly SandboxBotEngineInfo[] = [
    {
        name: `dummy`,
        displayName: `Dummy Bot`,
        description: () => i18next.t('aDummyBotImplementationJustPlacingCellsAsCloseToTheCenterAsPossible', 'A dummy bot implementation just placing cells as close to the center as possible.'),
    },
    {
        name: `seal`,
        displayName: `Seal Bot`,
        description: () => (
            <Trans
                i18nKey="sealBotDescription"
                defaults="Imaseal's bot implementation based on a minimax search with alpha-beta pruning (<link>available on GitHub</link>)."
                components={{ link: <NavLink to="https://github.com/Ramora0/HexTicTacToe" target="_blank" /> }}
            />
        ),
    },
];

export async function createSandboxBot(engine: string): Promise<BotEngineInterface> {
    const worker = new Worker(new URL(`./botWorker.ts`, import.meta.url), { type: `module` });
    const workerClient = new WorkerBotClient(worker);

    try {
        const response = await workerClient.request({ type: `init`, engine });
        if (response.type !== `ready`) {
            throw new Error(`Unexpected bot worker response: ${response.type}`);
        }

        return new WorkerBotInterface(workerClient, response.displayName, response.capabilities);
    } catch (error) {
        workerClient.dispose();
        throw error;
    }
}
