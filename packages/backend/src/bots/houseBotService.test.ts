import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import pino from 'pino';

import type { AuthRepository } from '../auth/authRepository';
import type { ServerConfig } from '../config/serverConfig';
import { ApiRequestError } from '../network/rest/apiQueryService';
import { BOT_ONLY_LOBBY_ABANDONED_AFTER_MS } from '../session/sessionManager';
import type { BotAccountRepository, HouseBot } from './botAccountRepository';
import { BotSeatManager } from './botSeatManager';
import { botProfile, createTestSessionManager, HUMAN_PROFILE, sessionsOf, settle, teardownGame } from './botTestFixtures';
import { EngineDriver } from './drivers/engineDriver';
import type { EngineWorkerPool } from './drivers/engineWorkerPool';
import { HouseBotService } from './houseBotService';

const SEAL_ID = `house-seal`;
const CLIENT = { ipAddress: `127.0.0.1`, userAgent: `test` } as never;
const OPTIONS = { visibility: `public` as const, timeControl: { mode: `turn` as const, turnTimeMs: 45_000 }, rated: true, firstPlayer: `host` as const };

function houseBot(id: string, engine: string): HouseBot {
    return {
        key: `house:${engine}`,
        account: { id, username: `SealBot`, image: null, ownerProfileId: null, createdAt: 0, tokenRotatedAt: null },
        driver: { type: `engine`, engine },
    };
}

type Fixture = {
    service: HouseBotService;
    driver: EngineDriver;
    sessionManager: ReturnType<typeof createTestSessionManager>;
    manager: BotSeatManager;
};

let seeded = 0;

async function createFixture(options: { maxGames?: number, bots?: HouseBot[] } = {}): Promise<Fixture> {
    const sessionManager = createTestSessionManager();
    const manager = new BotSeatManager(pino({ level: `silent` }), sessionManager);
    const pool = { suggestTurn: () => Promise.reject(new Error(`no think in this suite`)), shutdown: () => Promise.resolve() };
    const driver = new EngineDriver(pino({ level: `silent` }), sessionManager, pool as unknown as EngineWorkerPool);
    const bots = options.bots ?? [houseBot(SEAL_ID, `seal`)];
    const service = new HouseBotService(
        pino({ level: `silent` }),
        { houseBotMaxGames: options.maxGames ?? 2 } as ServerConfig,
        { seedHouseBots: async () => { seeded += 1; }, listHouseBots: async () => bots } as unknown as BotAccountRepository,
        { getUserProfileById: async (id: string) => bots.some((bot) => bot.account.id === id) ? botProfile(id, `SealBot`) : null } as unknown as AuthRepository,
        sessionManager,
        manager,
        driver,
        pool as unknown as EngineWorkerPool,
    );
    await service.attach();

    return { service, driver, sessionManager, manager };
}

function houseTest(name: string, body: (fixture: Fixture) => Promise<void>, options: { maxGames?: number, bots?: HouseBot[] } = {}): void {
    test(name, async () => {
        const fixture = await createFixture(options);
        try {
            await body(fixture);
        } finally {
            fixture.manager.detach();
            for (const session of sessionsOf(fixture.sessionManager).values()) {
                teardownGame(fixture.sessionManager, session);
            }
        }
    });
}

houseTest(`attach seeds the bots, claims them for the engine and lists them from the catalogue`, async ({ service, manager }) => {
    assert.ok(seeded > 0, `the seed runs at attach, flag on, never in a migration`);
    assert.equal(manager.getDriverType(SEAL_ID), `engine`);
    assert.deepEqual(service.listBots(), {
        bots: [{
            profileId: SEAL_ID,
            displayName: `SealBot`,
            engine: `seal`,
            thinkMs: { min: 10, max: 5_000, default: 300 },
            presets: [
                { id: `beginner`, thinkMs: 10 },
                { id: `easy`, thinkMs: 100 },
                { id: `medium`, thinkMs: 300 },
                { id: `hard`, thinkMs: 500 },
                { id: `expert`, thinkMs: 1_000 },
            ],
        }],
        available: true,
    });
});

houseTest(`a bot whose engine the worker cannot run is skipped, not offered`, async ({ service }) => {
    assert.deepEqual(service.listBots().bots, []);
}, { bots: [houseBot(`house-x`, `not-an-engine`)] });

houseTest(`creating a lobby seats the bot with its strength on the seat, unrated, open`, async ({ service, driver, sessionManager }) => {
    const { sessionId } = await service.createLobby(CLIENT, OPTIONS, { kind: `house-bot`, profileId: SEAL_ID, thinkMs: 300 });
    const session = sessionManager.requireSession(sessionId);

    assert.deepEqual(session.players.map((player) => [player.displayName, player.isBot, player.profileId, player.connection.status]), [
        [`SealBot 0.3s`, true, SEAL_ID, `connected`],
    ]);
    assert.equal(session.players[0]?.connection.status === `connected` && session.players[0].connection.socketId, `bot:${SEAL_ID}`);
    assert.deepEqual(session.reservedPlayerProfileIds, [], `a guest could not claim a reserved seat`);
    assert.equal(session.gameOptions.rated, false);
    assert.equal(session.gameOptions.firstPlayer, `random`);
    assert.equal(session.gameOptions.visibility, `public`, `visibility follows the dialog`);
    assert.deepEqual(driver.getSeatConfig(sessionId), { engine: `seal`, thinkMs: 300 });
    assert.equal(sessionManager.listLobbyInfo().length, 1, `it counts as a lobby`);
});

houseTest(`the human takes the open seat and the lobby starts by itself`, async ({ service, sessionManager }) => {
    const { sessionId } = await service.createLobby(CLIENT, OPTIONS, { kind: `house-bot`, profileId: SEAL_ID, thinkMs: 10 });
    const session = sessionManager.requireSession(sessionId);
    const participation = await sessionManager.joinSession(session, { deviceId: `device-h`, profile: HUMAN_PROFILE, displayName: `Timmy`, allowSelfJoinCasualGames: false });
    assert.equal(participation.role, `player`);
    sessionManager.assignParticipantSocket(session, participation.participant.id, `socket-h`);
    await sessionManager.tickAllSessions();

    assert.equal(session.state, `in-game`);
    assert.equal(session.players.length, 2);
});

houseTest(`an unknown bot and an out-of-range think time are refused before any lobby exists`, async ({ service, sessionManager }) => {
    await assert.rejects(
        service.createLobby(CLIENT, OPTIONS, { kind: `house-bot`, profileId: `nope`, thinkMs: 300 }),
        (error: unknown) => error instanceof ApiRequestError && error.statusCode === 404,
    );
    await assert.rejects(
        service.createLobby(CLIENT, OPTIONS, { kind: `house-bot`, profileId: SEAL_ID, thinkMs: 9_000 }),
        (error: unknown) => error instanceof ApiRequestError && error.statusCode === 400 && /between 0.01s and 5s/.test(error.message),
    );
    assert.equal(sessionsOf(sessionManager).size, 0);
});

houseTest(`capacity counts lobbies and games alike and refuses the next one, even in a race`, async ({ service, sessionManager }) => {
    const create = () => service.createLobby(CLIENT, OPTIONS, { kind: `house-bot`, profileId: SEAL_ID, thinkMs: 100 });
    const results = await Promise.allSettled([create(), create(), create()]);

    assert.deepEqual(results.map((result) => result.status), [`fulfilled`, `fulfilled`, `rejected`]);
    const refused = results[2];
    assert.ok(refused.status === `rejected` && refused.reason instanceof ApiRequestError && refused.reason.statusCode === 409);
    assert.equal(service.listBots().available, false);
    assert.equal(sessionsOf(sessionManager).size, 2, `the refused create left no lobby behind`);

    /* A finished game frees its slot. */
    const [first] = [...sessionsOf(sessionManager).values()];
    first!.state = `finished`;
    assert.equal(service.listBots().available, true);
    await create();
}, { maxGames: 2 });

houseTest(`a lobby nobody comes to is reaped and releases its strength pin`, async ({ service, driver, sessionManager }) => {
    const { sessionId } = await service.createLobby(CLIENT, OPTIONS, { kind: `house-bot`, profileId: SEAL_ID, thinkMs: 100 });
    const session = sessionManager.requireSession(sessionId);
    await sessionManager.tickAllSessions();
    assert.equal(sessionManager.getSession(sessionId), session, `a young lobby stays`);

    session.createdAt = Date.now() - BOT_ONLY_LOBBY_ABANDONED_AFTER_MS - 1_000;
    await sessionManager.tickAllSessions();

    assert.equal(sessionManager.getSession(sessionId), null);
    assert.equal(driver.getSeatConfig(sessionId), null);
    assert.equal(service.listBots().available, true);
});

houseTest(`a finished game is reaped once the human leaves: the bot's seat does not pin it`, async ({ service, sessionManager }) => {
    const { sessionId } = await service.createLobby(CLIENT, OPTIONS, { kind: `house-bot`, profileId: SEAL_ID, thinkMs: 10 });
    const session = sessionManager.requireSession(sessionId);
    const participation = await sessionManager.joinSession(session, { deviceId: `device-h`, profile: HUMAN_PROFILE, displayName: `Timmy`, allowSelfJoinCasualGames: false });
    sessionManager.assignParticipantSocket(session, participation.participant.id, `socket-h`);
    await sessionManager.tickAllSessions();
    assert.equal(session.state, `in-game`);

    await sessionManager.surrenderSession(session, participation.participant.id);
    await settle();
    assert.equal(session.state, `finished`);
    assert.equal(session.players.find((player) => player.isBot)?.connection.status, `connected`, `the bot stays for the human on the result screen`);
    assert.equal(service.listBots().available, true, `a finished game holds no capacity`);

    sessionManager.handleSocketDisconnect(`socket-h`);
    await sessionManager.tickAllSessions();
    await settle();
    assert.equal(sessionManager.getSession(sessionId), null);
    assert.equal(service.listBots().available, true);
});

houseTest(`rematch after a game against the bot: a new game, same strength on the seat`, async ({ service, driver, sessionManager }) => {
    const { sessionId } = await service.createLobby(CLIENT, OPTIONS, { kind: `house-bot`, profileId: SEAL_ID, thinkMs: 500 });
    const session = sessionManager.requireSession(sessionId);
    const participation = await sessionManager.joinSession(session, { deviceId: `device-h`, profile: HUMAN_PROFILE, displayName: `Timmy`, allowSelfJoinCasualGames: false });
    sessionManager.assignParticipantSocket(session, participation.participant.id, `socket-h`);
    await sessionManager.tickAllSessions();
    await settle();
    assert.equal(session.state, `in-game`);
    await sessionManager.surrenderSession(session, participation.participant.id);
    await settle();

    await sessionManager.requestRematch(session, participation.participant.id);
    await settle();

    const rematch = sessionManager.requireSession(sessionId);
    assert.notEqual(rematch, session);
    const botSeat = rematch.players.find((player) => player.isBot)!;
    assert.equal(botSeat.displayName, `SealBot 0.5s`);
    assert.equal(botSeat.connection.status, `connected`);
    assert.deepEqual(driver.getSeatConfig(sessionId), { engine: `seal`, thinkMs: 500 });
    assert.equal(service.listBots().available, true);

    const humanSeat = rematch.players.find((player) => !player.isBot)!;
    sessionManager.assignParticipantSocket(rematch, humanSeat.id, `socket-h`);
    await sessionManager.tickAllSessions();
    await settle();
    assert.equal(rematch.state, `in-game`);
    assert.equal(rematch.gameOptions.rated, false);
});

houseTest(`shutdown detaches the seat manager, so no finished-game grace outlives the server`, async ({ service, manager, sessionManager }) => {
    const { sessionId } = await service.createLobby(CLIENT, OPTIONS, { kind: `house-bot`, profileId: SEAL_ID, thinkMs: 10 });
    const session = sessionManager.requireSession(sessionId);
    const participation = await sessionManager.joinSession(session, { deviceId: `device-h`, profile: HUMAN_PROFILE, displayName: `Timmy`, allowSelfJoinCasualGames: false });
    sessionManager.assignParticipantSocket(session, participation.participant.id, `socket-h`);
    await sessionManager.tickAllSessions();
    await sessionManager.surrenderSession(session, participation.participant.id);
    await settle();
    assert.equal((manager as unknown as { finishedWatches: Map<string, unknown> }).finishedWatches.size, 1);

    await service.shutdown();

    assert.equal((manager as unknown as { finishedWatches: Map<string, unknown> }).finishedWatches.size, 0);
});
