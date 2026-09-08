import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import pino from 'pino';

import { botAccountsMigration } from '../persistence/migrations/013-bot-accounts';
import type { MongoDatabase } from '../persistence/mongoClient';
import { AUTH_USERS_COLLECTION_NAME, BOT_TOKENS_COLLECTION_NAME } from '../persistence/mongoCollections';
import { BotAccountRepository } from './botAccountRepository';

async function withRepository(
    run: (context: {
        repository: BotAccountRepository;
        database: Awaited<ReturnType<MongoClient[`db`]>>;
    }) => Promise<void>,
): Promise<void> {
    const server = await MongoMemoryServer.create();
    const client = new MongoClient(server.getUri());
    try {
        await client.connect();
        const database = client.db(`bot-accounts-test`);
        await botAccountsMigration.up({ database, logger: pino({ level: `silent` }) });
        const repository = new BotAccountRepository(pino({ level: `silent` }), {
            getDatabase: async () => database,
        } as MongoDatabase);

        await run({ repository, database });
    } finally {
        await client.close();
        await server.stop();
    }
}

test(`migration backfills kind and is safe to re-run`, async () => {
    await withRepository(async ({ database }) => {
        const users = database.collection(AUTH_USERS_COLLECTION_NAME);
        const legacyId = new ObjectId();
        await users.insertOne({ _id: legacyId, name: `Legacy Player` });

        const context = { database, logger: pino({ level: `silent` }) };
        await botAccountsMigration.up(context);
        await botAccountsMigration.up(context);

        assert.equal((await users.findOne({ _id: legacyId }))?.kind, `human`);
    });
});

test(`a legacy user without deletedAt is never returned as a bot`, async () => {
    await withRepository(async ({ repository, database }) => {
        await database.collection(AUTH_USERS_COLLECTION_NAME).insertOne({
            _id: new ObjectId(),
            name: `Legacy Player`,
            kind: `human`,
        });

        assert.deepEqual(await repository.listByOwner(`owner-1`), []);
        assert.equal(await repository.countByOwner(`owner-1`), 0);
    });
});

test(`bots created before the deletedAt convention still list`, async () => {
    await withRepository(async ({ repository, database }) => {
        const botId = new ObjectId();
        await database.collection(AUTH_USERS_COLLECTION_NAME).insertOne({
            _id: botId,
            name: `Legacy Bot`,
            kind: `bot`,
            ownerProfileId: `owner-1`,
            registeredAt: 1_700_000_000_000,
        });

        const bots = await repository.listByOwner(`owner-1`);
        assert.deepEqual(bots.map((bot) => bot.id), [botId.toHexString()]);
        assert.equal(bots[0]?.tokenRotatedAt, null);
    });
});

test(`soft delete hides the bot but keeps the user document`, async () => {
    await withRepository(async ({ repository, database }) => {
        const bot = await repository.create(`owner-1`, `Retired Bot`);
        await repository.replaceToken(bot.id, `hash-1`);

        assert.equal(await repository.softDelete(`owner-1`, bot.id), true);
        assert.equal(await repository.softDelete(`owner-1`, bot.id), false);
        assert.deepEqual(await repository.listByOwner(`owner-1`), []);
        assert.equal(await repository.findByOwner(`owner-1`, bot.id), null);

        const document = await database
            .collection(AUTH_USERS_COLLECTION_NAME)
            .findOne({ _id: new ObjectId(bot.id) });
        assert.equal(document?.name, `Retired Bot`);
        assert.equal(await database.collection(BOT_TOKENS_COLLECTION_NAME).countDocuments({ botProfileId: bot.id }), 0);
    });
});

test(`another owner cannot see or delete a bot`, async () => {
    await withRepository(async ({ repository }) => {
        const bot = await repository.create(`owner-1`, `Owned Bot`);

        assert.equal(await repository.findByOwner(`owner-2`, bot.id), null);
        assert.equal(await repository.softDelete(`owner-2`, bot.id), false);
        assert.equal(await repository.countByOwner(`owner-2`), 0);
        assert.equal(await repository.countByOwner(`owner-1`), 1);
    });
});

test(`replaceToken keeps one token per bot under the unique index`, async () => {
    await withRepository(async ({ repository, database }) => {
        const bot = await repository.create(`owner-1`, `Rotating Bot`);
        await repository.replaceToken(bot.id, `hash-1`);
        await repository.replaceToken(bot.id, `hash-2`);

        const tokens = await database.collection(BOT_TOKENS_COLLECTION_NAME)
            .find({ botProfileId: bot.id })
            .toArray();
        assert.equal(tokens.length, 1);
        assert.equal(tokens[0]?.tokenHash, `hash-2`);
    });
});

test(`an invalid bot id is rejected instead of throwing`, async () => {
    await withRepository(async ({ repository }) => {
        assert.equal(await repository.findByOwner(`owner-1`, `not-an-object-id`), null);
        assert.equal(await repository.softDelete(`owner-1`, `not-an-object-id`), false);
    });
});
