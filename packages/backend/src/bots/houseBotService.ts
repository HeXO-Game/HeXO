import {
    type CreateSessionResponse,
    formatThinkSeconds,
    type HouseBotListing,
    type HouseBotsResponse,
    type LobbyOpponent,
    type LobbyOptions,
} from '@ih3t/shared';
import { Mutex } from 'async-mutex';
import type { Logger } from 'pino';
import { inject, injectable } from 'tsyringe';

import { type AccountUserProfile, AuthRepository } from '../auth/authRepository';
import { ServerConfig } from '../config/serverConfig';
import { ROOT_LOGGER } from '../logger';
import type { RequestClientInfo } from '../network/clientInfo';
import { ApiRequestError } from '../network/rest/apiQueryService';
import { SessionManager } from '../session/sessionManager';
import { BotAccountRepository, type HouseBot } from './botAccountRepository';
import { type BotSeatPresence, seatBotInLobby, underBotSeatGate } from './botSeatGate';
import { BotSeatManager } from './botSeatManager';
import { ENGINE_CATALOGUE, type EngineName, isEngineName } from './drivers/engineCatalogue';
import { EngineDriver } from './drivers/engineDriver';
import { EngineWorkerPool } from './drivers/engineWorkerPool';

type LoadedHouseBot = HouseBot & { engine: EngineName, profile: AccountUserProfile };

/** A house bot is reached by running it: always present, one virtual socket per bot. */
const HOUSE_PRESENCE: BotSeatPresence = {
    isOnline: () => true,
    getSocketId: (botProfileId) => `bot:${botProfileId}`,
};

/**
 * The server's own opponents: loads the seeded bots, hands them to the engine driver,
 * and creates the lobbies a human picks one for. Strength is chosen per lobby and
 * carried on the seat's display name, so every list and HUD shows it.
 */
@injectable()
export class HouseBotService {
    private readonly logger: Logger;
    private bots: LoadedHouseBot[] = [];
    private readonly createMutex = new Mutex();

    constructor(
        @inject(ROOT_LOGGER) rootLogger: Logger,
        @inject(ServerConfig) private readonly serverConfig: ServerConfig,
        @inject(BotAccountRepository) private readonly botAccountRepository: BotAccountRepository,
        @inject(AuthRepository) private readonly authRepository: AuthRepository,
        @inject(SessionManager) private readonly sessionManager: SessionManager,
        @inject(BotSeatManager) private readonly botSeatManager: BotSeatManager,
        @inject(EngineDriver) private readonly engineDriver: EngineDriver,
        @inject(EngineWorkerPool) private readonly engineWorkerPool: EngineWorkerPool,
    ) {
        this.logger = rootLogger.child({ component: `house-bot-service` });
    }

    /** After the migrations, flag on: seed the bots and make them engine seats the manager drives. */
    async attach(): Promise<void> {
        await this.botAccountRepository.seedHouseBots();
        const loaded: LoadedHouseBot[] = [];
        for (const bot of await this.botAccountRepository.listHouseBots()) {
            const profile = await this.authRepository.getUserProfileById(bot.account.id);
            if (!isEngineName(bot.driver.engine) || !profile) {
                this.logger.warn({ event: `bots.house.skipped`, key: bot.key, engine: bot.driver.engine }, `House bot skipped`);
                continue;
            }

            this.engineDriver.registerBot(bot.account.id, bot.driver.engine);
            this.botSeatManager.assignDriver(bot.account.id, `engine`);
            loaded.push({ ...bot, engine: bot.driver.engine, profile });
        }

        this.bots = loaded;
        this.botSeatManager.registerDriver(this.engineDriver);
        this.botSeatManager.attach();
        this.logger.info({ event: `bots.house.attached`, bots: loaded.map((bot) => bot.account.username) }, `House bots attached`);
    }

    async shutdown(): Promise<void> {
        this.botSeatManager.detach();
        await this.engineWorkerPool.shutdown();
    }

    listBots(): HouseBotsResponse {
        return {
            bots: this.bots.map((bot): HouseBotListing => ({
                profileId: bot.account.id,
                displayName: bot.account.username,
                engine: bot.engine,
                thinkMs: { ...ENGINE_CATALOGUE[bot.engine].thinkMs },
                presets: [...ENGINE_CATALOGUE[bot.engine].presets],
            })),
            available: this.countEngineGames() < this.serverConfig.houseBotMaxGames,
        };
    }

    /**
     * A normal lobby with the bot's seat already taken: the dialog's visibility and
     * clock, never rated, first player random, no reserved seats — a guest has no
     * profile to reserve, and the open seat is for whoever comes, as with any lobby.
     */
    async createLobby(client: RequestClientInfo, lobbyOptions: LobbyOptions, opponent: LobbyOpponent): Promise<CreateSessionResponse> {
        const bot = this.bots.find((candidate) => candidate.account.id === opponent.profileId);
        if (!bot) {
            throw new ApiRequestError(404, `That bot does not exist.`);
        }

        const range = ENGINE_CATALOGUE[bot.engine].thinkMs;
        if (opponent.thinkMs < range.min || opponent.thinkMs > range.max) {
            throw new ApiRequestError(400, `${bot.account.username} thinks between ${formatThinkSeconds(range.min)} and ${formatThinkSeconds(range.max)}.`);
        }

        return await this.createMutex.runExclusive(() => underBotSeatGate(async () => {
            const capReached = () => new ApiRequestError(409, `${bot.account.username} is busy in ${this.serverConfig.houseBotMaxGames} games right now. Try again in a moment.`);
            if (this.countEngineGames() >= this.serverConfig.houseBotMaxGames) {
                /* Refused before a lobby exists; the gate's own check below is the atomic one. */
                throw capReached();
            }

            const response = this.sessionManager.createSession({
                client,
                lobbyOptions: { ...lobbyOptions, rated: false, firstPlayer: `random` },
                reservedPlayerProfileIds: [],
            });
            const session = this.sessionManager.requireSession(response.sessionId);

            /* Pinned before the seat exists, so the first turn already knows its budget. */
            this.engineDriver.configureSeat(session.id, { engine: bot.engine, thinkMs: opponent.thinkMs });
            try {
                await seatBotInLobby(
                    { sessionManager: this.sessionManager, presence: HOUSE_PRESENCE },
                    session,
                    bot.profile,
                    () => this.countEngineGames(),
                    {
                        offline: () => new ApiRequestError(503, `${bot.account.username} is not available right now.`),
                        capReached,
                        seatLost: () => new ApiRequestError(409, `${bot.account.username} could not take its seat.`),
                    },
                    {
                        maxGames: this.serverConfig.houseBotMaxGames,
                        displayName: `${bot.account.username} ${formatThinkSeconds(opponent.thinkMs)}`,
                    },
                );
            } catch (error: unknown) {
                /* The lobby is empty now and the sweep retires it; the pin goes with it. */
                this.engineDriver.releaseSeat(session.id);
                throw error;
            }

            this.logger.info(
                { event: `bots.house.lobby.created`, botProfileId: bot.account.id, sessionId: session.id, thinkMs: opponent.thinkMs },
                `House bot lobby created`,
            );
            return response;
        }));
    }

    /** Sessions, lobby or in-game, with a house bot seated; the cap counts lobbies too. */
    private countEngineGames(): number {
        const sessionIds = new Set<string>();
        for (const bot of this.bots) {
            for (const participation of this.sessionManager.getPlayerParticipationsByProfileId(bot.account.id)) {
                if (participation.role === `player` && participation.session.state !== `finished`) {
                    sessionIds.add(participation.session.id);
                }
            }
        }

        return sessionIds.size;
    }
}
