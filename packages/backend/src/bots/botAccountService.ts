import { BotAccount } from '@ih3t/shared';
import { Mutex } from 'async-mutex';
import { createHash, randomBytes } from 'node:crypto';
import { inject, injectable } from 'tsyringe';

import type { AccountUserProfile } from '../auth/authRepository';
import { ApiRequestError } from '../network/rest/apiQueryService';
import { BotAccountRepository } from './botAccountRepository';

const BASE62_ALPHABET = `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`;
const TOKEN_PREFIX = `hxo_`;
const TOKEN_BYTES = 32;

export const MAX_BOTS_PER_OWNER = 3;
/* Constants, not config: a server operator has no reason to tune either of these, and
 * neither is part of the contract. */
export const MAX_CONCURRENT_GAMES_PER_BOT = 4;

export type IssuedBotAccount = {
    bot: BotAccount;
    token: string;
};

@injectable()
export class BotAccountService {
    /* Creation is rare, so a single lock shared by all owners is enough to keep the limit exact. */
    private readonly createLock = new Mutex();

    constructor(
        @inject(BotAccountRepository) private readonly botAccountRepository: BotAccountRepository,
    ) { }

    async listBots(owner: AccountUserProfile): Promise<BotAccount[]> {
        return await this.botAccountRepository.listByOwner(owner.id);
    }

    async createBot(owner: AccountUserProfile, username: string): Promise<IssuedBotAccount> {
        this.assertHumanOwner(owner);

        return await this.createLock.runExclusive(async () => {
            if (await this.botAccountRepository.countByOwner(owner.id) >= MAX_BOTS_PER_OWNER) {
                throw new ApiRequestError(409, `You can own at most ${MAX_BOTS_PER_OWNER} bots.`);
            }

            return await this.issueToken(await this.botAccountRepository.create(owner.id, username));
        });
    }

    async rotateToken(owner: AccountUserProfile, botProfileId: string): Promise<IssuedBotAccount> {
        this.assertHumanOwner(owner);

        const bot = await this.botAccountRepository.findByOwner(owner.id, botProfileId);
        if (!bot) {
            throw new ApiRequestError(404, `Bot not found.`);
        }

        return await this.issueToken(bot);
    }

    async deleteBot(owner: AccountUserProfile, botProfileId: string): Promise<void> {
        this.assertHumanOwner(owner);

        const deleted = await this.botAccountRepository.softDelete(owner.id, botProfileId);
        if (!deleted) {
            throw new ApiRequestError(404, `Bot not found.`);
        }
    }

    private async issueToken(bot: BotAccount): Promise<IssuedBotAccount> {
        const token = this.generateToken();
        const tokenRotatedAt = await this.botAccountRepository.replaceToken(bot.id, hashBotToken(token));

        return {
            bot: { ...bot, tokenRotatedAt },
            token,
        };
    }

    private generateToken(): string {
        let value = BigInt(`0x${randomBytes(TOKEN_BYTES).toString(`hex`)}`);
        let encoded = ``;
        do {
            encoded = BASE62_ALPHABET[Number(value % 62n)] + encoded;
            value /= 62n;
        } while (value > 0n);

        return `${TOKEN_PREFIX}${encoded}`;
    }

    private assertHumanOwner(owner: AccountUserProfile): void {
        if (owner.kind !== `human`) {
            throw new ApiRequestError(403, `Bots cannot own bots.`);
        }
    }
}

export function hashBotToken(token: string): string {
    return createHash(`sha256`).update(token)
        .digest(`hex`);
}
