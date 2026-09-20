import 'reflect-metadata';

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { BotAccount } from '@ih3t/shared';

import type { AccountUserProfile } from '../auth/authRepository';
import { ApiRequestError } from '../network/rest/apiQueryService';
import type { BotAccountRepository } from './botAccountRepository';
import { BotAccountService, hashBotToken, MAX_BOTS_PER_OWNER } from './botAccountService';

class FakeBotAccountRepository {
    private nextId = 1;
    readonly bots = new Map<string, BotAccount & { deletedAt: number | null }>();
    readonly tokenHashes = new Map<string, string>();

    countByOwner(ownerProfileId: string): Promise<number> {
        return Promise.resolve(this.activeBots(ownerProfileId).length);
    }

    listByOwner(ownerProfileId: string): Promise<BotAccount[]> {
        return Promise.resolve(this.activeBots(ownerProfileId));
    }

    findByOwner(ownerProfileId: string, botProfileId: string): Promise<BotAccount | null> {
        const bot = this.bots.get(botProfileId);
        if (!bot || bot.ownerProfileId !== ownerProfileId || bot.deletedAt !== null) {
            return Promise.resolve(null);
        }

        return Promise.resolve(bot);
    }

    create(ownerProfileId: string, username: string): Promise<BotAccount> {
        const bot = {
            id: `bot-${this.nextId++}`,
            username,
            image: null,
            ownerProfileId,
            createdAt: 1_700_000_000_000,
            tokenRotatedAt: null,
            deletedAt: null,
        };
        this.bots.set(bot.id, bot);

        return Promise.resolve(bot);
    }

    softDelete(ownerProfileId: string, botProfileId: string): Promise<boolean> {
        const bot = this.bots.get(botProfileId);
        if (!bot || bot.ownerProfileId !== ownerProfileId || bot.deletedAt !== null) {
            return Promise.resolve(false);
        }

        bot.deletedAt = Date.now();
        this.tokenHashes.delete(botProfileId);

        return Promise.resolve(true);
    }

    replaceToken(botProfileId: string, tokenHash: string): Promise<number> {
        this.tokenHashes.set(botProfileId, tokenHash);

        return Promise.resolve(1_700_000_000_001);
    }

    deleteToken(botProfileId: string): Promise<void> {
        this.tokenHashes.delete(botProfileId);

        return Promise.resolve();
    }

    private activeBots(ownerProfileId: string): (BotAccount & { deletedAt: number | null })[] {
        return [...this.bots.values()].filter(
            (bot) => bot.ownerProfileId === ownerProfileId && bot.deletedAt === null,
        );
    }
}

function createOwner(overrides: Partial<AccountUserProfile> = {}): AccountUserProfile {
    return {
        id: `owner-1`,
        username: `Owner`,
        email: null,
        image: null,
        role: `user`,
        kind: `human`,
        permissions: [],
        registeredAt: 1_700_000_000_000,
        lastActiveAt: 1_700_000_000_000,
        ...overrides,
    };
}

function createService(): { service: BotAccountService; repository: FakeBotAccountRepository } {
    const repository = new FakeBotAccountRepository();
    const service = new BotAccountService(repository as unknown as BotAccountRepository);

    return { service, repository };
}

test(`createBot issues a prefixed token and stores only its hash`, async () => {
    const { service, repository } = createService();

    const { bot, token } = await service.createBot(createOwner(), `Nearest Bot`);

    assert.match(token, /^hxo_[0-9A-Za-z]{40,}$/);
    assert.equal(bot.username, `Nearest Bot`);
    assert.equal(repository.tokenHashes.get(bot.id), createHash(`sha256`).update(token).digest(`hex`));
    assert.equal([...repository.tokenHashes.values()].includes(token), false);
});

test(`createBot issues a distinct token per call`, async () => {
    const { service } = createService();
    const owner = createOwner();

    const first = await service.createBot(owner, `Bot One`);
    const second = await service.createBot(owner, `Bot Two`);

    assert.notEqual(first.token, second.token);
});

test(`createBot rejects more than the per-owner limit`, async () => {
    const { service } = createService();
    const owner = createOwner();

    for (let index = 0; index < MAX_BOTS_PER_OWNER; index += 1) {
        await service.createBot(owner, `Bot ${index}`);
    }

    await assert.rejects(
        () => service.createBot(owner, `One Too Many`),
        (error: unknown) => error instanceof ApiRequestError && error.statusCode === 409,
    );
});

test(`concurrent createBot calls fill the limit exactly`, async () => {
    const { service } = createService();
    const owner = createOwner();

    const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_unused, index) => service.createBot(owner, `Bot ${index}`)),
    );

    const created = results.filter((result) => result.status === `fulfilled`);
    assert.equal(created.length, MAX_BOTS_PER_OWNER);
    assert.equal((await service.listBots(owner)).length, MAX_BOTS_PER_OWNER);
    for (const result of results.filter((entry) => entry.status === `rejected`)) {
        assert.equal((result as PromiseRejectedResult).reason instanceof ApiRequestError, true);
        assert.equal(((result as PromiseRejectedResult).reason as ApiRequestError).statusCode, 409);
    }
});

test(`createBot rejects a bot owner`, async () => {
    const { service } = createService();

    await assert.rejects(
        () => service.createBot(createOwner({ kind: `bot` }), `Nested Bot`),
        (error: unknown) => error instanceof ApiRequestError && error.statusCode === 403,
    );
});

test(`rotateToken replaces the stored hash`, async () => {
    const { service, repository } = createService();
    const owner = createOwner();

    const created = await service.createBot(owner, `Rotating Bot`);
    const createdHash = repository.tokenHashes.get(created.bot.id);
    const rotated = await service.rotateToken(owner, created.bot.id);

    assert.notEqual(rotated.token, created.token);
    assert.notEqual(repository.tokenHashes.get(created.bot.id), createdHash);
    assert.equal(repository.tokenHashes.get(created.bot.id), hashBotToken(rotated.token));
});

test(`rotateToken rejects a bot owned by somebody else`, async () => {
    const { service } = createService();
    const created = await service.createBot(createOwner(), `Someone Elses Bot`);

    await assert.rejects(
        () => service.rotateToken(createOwner({ id: `owner-2` }), created.bot.id),
        (error: unknown) => error instanceof ApiRequestError && error.statusCode === 404,
    );
});

test(`deleteBot frees a slot and revokes the token`, async () => {
    const { service, repository } = createService();
    const owner = createOwner();

    const created = await service.createBot(owner, `Retired Bot`);
    await service.deleteBot(owner, created.bot.id);

    assert.equal(repository.tokenHashes.has(created.bot.id), false);
    assert.deepEqual(await service.listBots(owner), []);
    await assert.doesNotReject(() => service.createBot(owner, `Replacement Bot`));
});

test(`deleteBot rejects a bot owned by somebody else`, async () => {
    const { service } = createService();
    const created = await service.createBot(createOwner(), `Someone Elses Bot`);

    await assert.rejects(
        () => service.deleteBot(createOwner({ id: `owner-2` }), created.bot.id),
        (error: unknown) => error instanceof ApiRequestError && error.statusCode === 404,
    );
});
