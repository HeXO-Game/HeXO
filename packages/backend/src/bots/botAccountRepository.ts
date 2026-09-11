import { BotAccount } from '@ih3t/shared';
import { Collection, type Document, ObjectId } from 'mongodb';
import type { Logger } from 'pino';
import { inject, injectable } from 'tsyringe';

import { DEFAULT_PLAYER_ELO } from '../elo/eloRepository';
import { ROOT_LOGGER } from '../logger';
import { MongoDatabase } from '../persistence/mongoClient';
import { AUTH_USERS_COLLECTION_NAME, BOT_TOKENS_COLLECTION_NAME } from '../persistence/mongoCollections';

type BotUserDocument = {
    _id: ObjectId;
    name?: string | null;
    image?: string | null;
    kind?: string;
    ownerProfileId?: string;
    registeredAt?: number;
    deletedAt?: number | null;
} & Document;

type BotTokenDocument = {
    _id: ObjectId;
    botProfileId: string;
    tokenHash: string;
    createdAt: number;
    lastUsedAt: number | null;
} & Document;

@injectable()
export class BotAccountRepository {
    private readonly logger: Logger;
    private usersCollectionPromise: Promise<Collection<BotUserDocument>> | null = null;
    private tokensCollectionPromise: Promise<Collection<BotTokenDocument>> | null = null;

    constructor(
        @inject(ROOT_LOGGER) rootLogger: Logger,
        @inject(MongoDatabase) private readonly mongoDatabase: MongoDatabase,
    ) {
        this.logger = rootLogger.child({ component: `bot-account-repository` });
    }

    async countByOwner(ownerProfileId: string): Promise<number> {
        const collection = await this.getUsersCollection();
        return await collection.countDocuments({ kind: `bot`, ownerProfileId, deletedAt: null });
    }

    async listByOwner(ownerProfileId: string): Promise<BotAccount[]> {
        const collection = await this.getUsersCollection();
        const documents = await collection
            .find({ kind: `bot`, ownerProfileId, deletedAt: null })
            .sort({ registeredAt: 1 })
            .toArray();
        const tokens = await this.getTokensByBotIds(documents.map((document) => document._id.toHexString()));

        return documents.map((document) => this.mapBotAccount(document, tokens.get(document._id.toHexString()) ?? null));
    }

    async findByOwner(ownerProfileId: string, botProfileId: string): Promise<BotAccount | null> {
        const collection = await this.getUsersCollection();
        const objectId = this.parseObjectId(botProfileId);
        if (!objectId) {
            return null;
        }

        const document = await collection.findOne({ _id: objectId, kind: `bot`, ownerProfileId, deletedAt: null });
        if (!document) {
            return null;
        }

        const tokens = await this.getTokensByBotIds([botProfileId]);
        return this.mapBotAccount(document, tokens.get(botProfileId) ?? null);
    }

    async create(ownerProfileId: string, username: string): Promise<BotAccount> {
        const collection = await this.getUsersCollection();
        const now = Date.now();
        const document: BotUserDocument = {
            _id: new ObjectId(),
            name: username,
            image: null,
            role: `user`,
            kind: `bot`,
            ownerProfileId,
            permissions: [],
            elo: DEFAULT_PLAYER_ELO,
            registeredAt: now,
            lastActiveAt: now,
            deletedAt: null,
        };

        await collection.insertOne(document);
        return this.mapBotAccount(document, null);
    }

    async softDelete(ownerProfileId: string, botProfileId: string): Promise<boolean> {
        const collection = await this.getUsersCollection();
        const objectId = this.parseObjectId(botProfileId);
        if (!objectId) {
            return false;
        }

        const result = await collection.updateOne(
            { _id: objectId, kind: `bot`, ownerProfileId, deletedAt: null },
            { $set: { deletedAt: Date.now() } },
        );
        if (result.matchedCount === 0) {
            return false;
        }

        await this.deleteToken(botProfileId);
        return true;
    }

    async replaceToken(botProfileId: string, tokenHash: string): Promise<number> {
        const collection = await this.getTokensCollection();
        const createdAt = Date.now();
        await collection.replaceOne(
            { botProfileId },
            { botProfileId, tokenHash, createdAt, lastUsedAt: null },
            { upsert: true },
        );

        return createdAt;
    }

    async deleteToken(botProfileId: string): Promise<void> {
        const collection = await this.getTokensCollection();
        await collection.deleteOne({ botProfileId });
    }

    private async getTokensByBotIds(botProfileIds: string[]): Promise<Map<string, number>> {
        if (botProfileIds.length === 0) {
            return new Map();
        }

        const collection = await this.getTokensCollection();
        const documents = await collection.find({ botProfileId: { $in: botProfileIds } }).toArray();

        return new Map(documents.map((document) => [document.botProfileId, document.createdAt]));
    }

    private mapBotAccount(document: BotUserDocument, tokenRotatedAt: number | null): BotAccount {
        return {
            id: document._id.toHexString(),
            username: document.name?.trim() ?? `Bot`,
            image: document.image ?? null,
            ownerProfileId: document.ownerProfileId ?? ``,
            createdAt: document.registeredAt ?? 0,
            tokenRotatedAt,
        };
    }

    private parseObjectId(value: string | undefined | null): ObjectId | null {
        if (!value || !ObjectId.isValid(value)) {
            return null;
        }

        return new ObjectId(value);
    }

    private async getUsersCollection(): Promise<Collection<BotUserDocument>> {
        if (this.usersCollectionPromise) {
            return this.usersCollectionPromise;
        }

        this.usersCollectionPromise = (async () => {
            const database = await this.mongoDatabase.getDatabase();
            return database.collection<BotUserDocument>(AUTH_USERS_COLLECTION_NAME);
        })().catch((error: unknown) => {
            this.usersCollectionPromise = null;
            this.logger.error({ err: error, event: `bots.users.init.failed` }, `Failed to initialize bot users collection`);
            throw error;
        });

        return this.usersCollectionPromise;
    }

    private async getTokensCollection(): Promise<Collection<BotTokenDocument>> {
        if (this.tokensCollectionPromise) {
            return this.tokensCollectionPromise;
        }

        this.tokensCollectionPromise = (async () => {
            const database = await this.mongoDatabase.getDatabase();
            return database.collection<BotTokenDocument>(BOT_TOKENS_COLLECTION_NAME);
        })().catch((error: unknown) => {
            this.tokensCollectionPromise = null;
            this.logger.error({ err: error, event: `bots.tokens.init.failed` }, `Failed to initialize bot tokens collection`);
            throw error;
        });

        return this.tokensCollectionPromise;
    }
}
