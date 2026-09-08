import 'reflect-metadata';

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';

import express from 'express';

import type { AccountUserProfile } from '../../auth/authRepository';
import { MAX_BOTS_PER_OWNER } from '../../bots/botAccountService';
import { ApiRequestError } from './apiQueryService';
import { ApiRouter } from './createApiRouter';

const owner = { id: `owner-1`, kind: `human` } as AccountUserProfile;
const bot = {
    id: `bot-1`,
    username: `Botty`,
    image: null,
    ownerProfileId: owner.id,
    createdAt: 1,
    tokenRotatedAt: 1,
};

function createRouter(overrides: {
    user?: AccountUserProfile | null;
    botApiEnabled?: boolean;
    botAccountService?: Partial<Record<string, unknown>>;
}) {
    const botAccountService = {
        listBots: () => Promise.resolve([bot]),
        createBot: () => Promise.resolve({ bot, token: `hxo_secret` }),
        rotateToken: () => Promise.resolve({ bot, token: `hxo_rotated` }),
        deleteBot: () => Promise.resolve(),
        ...overrides.botAccountService,
    };

    return new ApiRouter(
        {} as never,
        { getUserFromRequest: () => Promise.resolve(overrides.user ?? null) } as never,
        {} as never,
        { isEnabled: () => false } as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        { botApiEnabled: overrides.botApiEnabled ?? true } as never,
        botAccountService as never,
    );
}

async function withServer(
    router: ApiRouter,
    run: (baseUrl: string) => Promise<void>,
): Promise<void> {
    const app = express();
    app.use(`/api`, router.router);
    const server = app.listen(0);
    await new Promise((resolve) => server.once(`listening`, resolve));

    try {
        await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

test(`bot routes reject a signed out request`, async () => {
    await withServer(createRouter({ user: null }), async (baseUrl) => {
        const response = await fetch(`${baseUrl}/account/bots`);
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), { error: `Sign in with Discord to manage bots.` });
    });
});

test(`listing bots reports the per owner limit`, async () => {
    await withServer(createRouter({ user: owner }), async (baseUrl) => {
        const response = await fetch(`${baseUrl}/account/bots`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { bots: [bot], limit: MAX_BOTS_PER_OWNER });
    });
});

test(`creating a bot answers 201 with the issued token`, async () => {
    await withServer(createRouter({ user: owner }), async (baseUrl) => {
        const response = await fetch(`${baseUrl}/account/bots`, {
            method: `POST`,
            headers: { 'Content-Type': `application/json` },
            body: JSON.stringify({ username: `Botty` }),
        });

        assert.equal(response.status, 201);
        assert.deepEqual(await response.json(), { bot, token: `hxo_secret` });
    });
});

test(`rotating a token passes the bot id through`, async () => {
    const seen: string[] = [];
    const router = createRouter({
        user: owner,
        botAccountService: {
            rotateToken: (_owner: AccountUserProfile, botProfileId: string) => {
                seen.push(botProfileId);
                return Promise.resolve({ bot, token: `hxo_rotated` });
            },
        },
    });

    await withServer(router, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/account/bots/bot-1/token`, { method: `POST` });
        assert.equal(response.status, 200);
        assert.deepEqual(seen, [`bot-1`]);
    });
});

test(`deleting a bot answers with the refreshed list`, async () => {
    const router = createRouter({
        user: owner,
        botAccountService: { listBots: () => Promise.resolve([]) },
    });

    await withServer(router, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/account/bots/bot-1`, { method: `DELETE` });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { bots: [], limit: MAX_BOTS_PER_OWNER });
    });
});

test(`a service rejection is mapped to its status code`, async () => {
    const router = createRouter({
        user: owner,
        botAccountService: {
            createBot: () => Promise.reject(new ApiRequestError(409, `You can own at most 3 bots.`)),
        },
    });

    await withServer(router, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/account/bots`, {
            method: `POST`,
            headers: { 'Content-Type': `application/json` },
            body: JSON.stringify({ username: `Botty` }),
        });

        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), { error: `You can own at most 3 bots.` });
    });
});

test(`the routes are absent while the flag is off`, async () => {
    await withServer(createRouter({ user: owner, botApiEnabled: false }), async (baseUrl) => {
        const response = await fetch(`${baseUrl}/account/bots`);
        assert.equal(response.status, 404);
    });
});
