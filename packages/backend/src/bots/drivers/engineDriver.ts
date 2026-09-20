import {
    applyGameMove,
    cloneGameState,
    type GameState,
    getCellKey,
    type HexCoordinate,
    isCellWithinPlacementRadius,
} from '@ih3t/shared';
import type { Logger } from 'pino';
import { inject, injectable } from 'tsyringe';

import { ROOT_LOGGER } from '../../logger';
import { SessionError, SessionManager } from '../../session/sessionManager';
import type { BotSeat, BotSeatDriver } from '../botSeatManager';
import { ENGINE_CATALOGUE, type EngineName } from './engineCatalogue';
import { EngineWorkerPool } from './engineWorkerPool';

/** How one seat is played: which engine, and how long it may think per turn. */
export type EngineSeatConfig = {
    engine: EngineName;
    thinkMs: number;
};

/* Left on the clock for the lock, the tick and the network; a think never eats it. */
const CLOCK_MARGIN_MS = 500;
const MIN_BUDGET_MS = 10;

/**
 * Plays a bot seat with an engine the server runs: think in the pool, apply the turn
 * through `placeCells`. A think that fails outright resigns the seat rather than
 * leaving it to time out; a legal-but-odd suggestion is completed, not refused.
 */
@injectable()
export class EngineDriver implements BotSeatDriver {
    readonly type = `engine` as const;
    private readonly logger: Logger;
    /** Which engine a house bot runs by default, keyed by profile id. */
    private readonly bots = new Map<string, EngineName>();
    /** The strength chosen for a lobby, keyed by session id; set when the seat is claimed. */
    private readonly seatConfigs = new Map<string, EngineSeatConfig>();
    private readonly thinking = new Set<string>();

    constructor(
        @inject(ROOT_LOGGER) rootLogger: Logger,
        @inject(SessionManager) private readonly sessionManager: SessionManager,
        @inject(EngineWorkerPool) private readonly pool: EngineWorkerPool,
    ) {
        this.logger = rootLogger.child({ component: `engine-driver` });
    }

    registerBot(botProfileId: string, engine: EngineName): void {
        this.bots.set(botProfileId, engine);
    }

    /** Pins a lobby's strength; the seat manager reads it back on every turn. */
    configureSeat(sessionId: string, config: EngineSeatConfig): void {
        this.seatConfigs.set(sessionId, config);
    }

    getSeatConfig(sessionId: string): EngineSeatConfig | null {
        return this.seatConfigs.get(sessionId) ?? null;
    }

    releaseSeat(sessionId: string): void {
        this.seatConfigs.delete(sessionId);
    }

    onStart(): void {
        /* Nothing to announce: the engine has no connection to tell. */
    }

    onTurn(seat: BotSeat, state: GameState, clock: { expiresInMs: number | null }): void {
        const config = this.resolveConfig(seat);
        if (!config) {
            /* A seat nothing can play is resigned, not left to its clock. */
            this.logger.warn({ event: `bots.engine.unknown-seat`, botProfileId: seat.botProfileId }, `No engine for a bot seat; resigning`);
            void this.resign(seat);
            return;
        }

        const key = `${seat.sessionId}::${seat.seatId}`;
        if (this.thinking.has(key)) {
            /* Unreachable against one opponent; loud rather than a silently dropped turn. */
            this.logger.warn({ event: `bots.engine.turn.busy`, sessionId: seat.sessionId }, `A turn arrived while the previous think is still running`);
            return;
        }

        this.thinking.add(key);
        /* Queued: the manager called from inside the session lock. */
        void this.play(seat, state, config, budgetFor(config.thinkMs, clock.expiresInMs))
            .catch((error: unknown) => {
                this.logger.error({ err: error, event: `bots.engine.turn.failed`, sessionId: seat.sessionId }, `Engine turn failed`);
            })
            .finally(() => this.thinking.delete(key));
    }

    onFinish(): void {
        /* The pin stays: a rematch keeps the session id, and with it the strength. */
    }

    onRematchRequested(): boolean {
        return true;
    }

    onSessionRemoved(sessionId: string): void {
        this.releaseSeat(sessionId);
    }

    /**
     * A complete, legal turn for `playerId`, or as much of one as the board allows:
     * the engine's answer is checked stone by stone against the rules and any gap is
     * filled with the nearest legal cell. Also the dev autoplay's engine.
     */
    async suggestLegalTurn(engine: EngineName, gameState: GameState, playerId: string, budgetMs: number): Promise<HexCoordinate[]> {
        const state = cloneGameState(gameState);
        if (state.currentTurnPlayerId !== playerId || state.placementsRemaining <= 0) {
            return [];
        }

        if (state.cells.length === 0) {
            return sanitizeTurn(state, playerId, [{ x: 0, y: 0 }]);
        }

        const suggestion = await this.pool.suggestTurn(engine, cloneGameState(state), budgetMs);
        return sanitizeTurn(state, playerId, suggestion.status === `provide` ? suggestion.suggestion : []);
    }

    private resolveConfig(seat: BotSeat): EngineSeatConfig | null {
        const pinned = this.seatConfigs.get(seat.sessionId);
        if (pinned) {
            return pinned;
        }

        const engine = this.bots.get(seat.botProfileId);
        return engine ? { engine, thinkMs: ENGINE_CATALOGUE[engine].thinkMs.default } : null;
    }

    private async play(seat: BotSeat, state: GameState, config: EngineSeatConfig, budgetMs: number): Promise<void> {
        const session = this.sessionManager.getSession(seat.sessionId);
        if (!session) {
            return;
        }

        let cells: HexCoordinate[];
        try {
            cells = await this.suggestLegalTurn(config.engine, state, seat.seatId, budgetMs);
        } catch (error: unknown) {
            if (this.pool.isShutDown) {
                /* The process is going down; a resign now would race the database close. */
                return;
            }

            this.logger.warn({ err: error, event: `bots.engine.think.failed`, sessionId: seat.sessionId }, `Engine think failed; resigning`);
            await this.resign(seat);
            return;
        }

        if (cells.length === 0) {
            /* The position moved on under us (a clock expiry, a finish); nothing to play. */
            return;
        }

        try {
            await this.sessionManager.placeCells(session, seat.seatId, cells);
        } catch (error: unknown) {
            if (!(error instanceof SessionError)) {
                throw error;
            }

            if (session.state === `in-game` && session.gameState.currentTurnPlayerId === seat.seatId) {
                /* Still our move and the rules refused a turn we already checked: resign
                 * rather than sit on a seat nothing can play. */
                this.logger.warn({ err: error, event: `bots.engine.move.refused`, sessionId: seat.sessionId }, `Engine move refused; resigning`);
                await this.resign(seat);
            }
        }
    }

    private async resign(seat: BotSeat): Promise<void> {
        const session = this.sessionManager.getSession(seat.sessionId);
        if (!session || session.state !== `in-game`) {
            return;
        }

        try {
            await this.sessionManager.surrenderSession(session, seat.seatId);
        } catch (error: unknown) {
            this.logger.warn({ err: error, event: `bots.engine.resign.failed`, sessionId: seat.sessionId }, `Engine seat could not resign`);
        }
    }
}

export function budgetFor(thinkMs: number, expiresInMs: number | null): number {
    const capped = expiresInMs === null ? thinkMs : Math.min(thinkMs, expiresInMs - CLOCK_MARGIN_MS);
    return Math.max(MIN_BUDGET_MS, capped);
}

/** Keeps the legal prefix of a suggestion and fills the rest of the turn. */
export function sanitizeTurn(gameState: GameState, playerId: string, suggested: readonly HexCoordinate[]): HexCoordinate[] {
    const simulated = cloneGameState(gameState);
    const accepted: HexCoordinate[] = [];

    for (const move of suggested) {
        if (simulated.currentTurnPlayerId !== playerId || simulated.placementsRemaining <= 0) {
            break;
        }

        try {
            applyGameMove(simulated, { playerId, x: move.x, y: move.y });
            accepted.push(move);
        } catch {
            /* An illegal stone is skipped; the fallback below completes the turn. */
        }
    }

    while (simulated.currentTurnPlayerId === playerId && simulated.placementsRemaining > 0) {
        const fallback = findFallbackMove(simulated, playerId);
        if (!fallback) {
            break;
        }

        applyGameMove(simulated, { playerId, x: fallback.x, y: fallback.y });
        accepted.push(fallback);
    }

    return accepted;
}

function findFallbackMove(gameState: GameState, playerId: string): HexCoordinate | null {
    if (gameState.currentTurnPlayerId !== playerId || gameState.placementsRemaining <= 0) {
        return null;
    }

    if (gameState.cells.length === 0) {
        return { x: 0, y: 0 };
    }

    const occupied = new Set(gameState.cells.map((cell) => getCellKey(cell.x, cell.y)));
    const maxCoordinate = gameState.cells.reduce((currentMax, cell) =>
        Math.max(currentMax, Math.abs(cell.x), Math.abs(cell.y), Math.abs(cell.x + cell.y)), 0);
    const searchRadius = maxCoordinate + 10;

    for (let radius = 0; radius <= searchRadius; radius += 1) {
        for (let x = -radius; x <= radius; x += 1) {
            for (let y = -radius; y <= radius; y += 1) {
                if (occupied.has(getCellKey(x, y))) {
                    continue;
                }

                const candidate = { x, y };
                if (!isCellWithinPlacementRadius(gameState.cells, candidate)) {
                    continue;
                }

                const trial = cloneGameState(gameState);
                try {
                    applyGameMove(trial, { playerId, x: candidate.x, y: candidate.y });
                    return candidate;
                } catch {
                    /* Keep scanning until a legal cell turns up. */
                }
            }
        }
    }

    return null;
}
