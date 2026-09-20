import { Mutex } from 'async-mutex';

import { type AccountUserProfile } from '../auth/authRepository';
import { ApiRequestError } from '../network/rest/apiQueryService';
import type { SessionManager } from '../session/sessionManager';
import type { ServerGameSession } from '../session/types';
import { MAX_CONCURRENT_GAMES_PER_BOT } from './botAccountService';

/** What a claim needs to know about how the bot is reached: the stream registry for
 * API bots, a constant for a server-driven one. */
export type BotSeatPresence = {
    isOnline(botProfileId: string): boolean;
    getSocketId(botProfileId: string): string;
};

/**
 * One gate for every path that seats a bot into a lobby. The concurrent-game cap
 * reads a count across all sessions, which no per-session lock can guard, so the
 * REST join, the website's Play, and challenge create/accept all claim through
 * here. Ordering is one-way and innermost: a service mutex, then this gate, then
 * the session lock — nothing under a session lock ever claims a seat.
 */
export const botSeatGate = new Mutex();

export function underBotSeatGate<T>(claim: () => Promise<T>): Promise<T> {
    return botSeatGate.runExclusive(claim);
}

/**
 * The claim itself, always run under `underBotSeatGate`: count the bot's games,
 * take the seat, and give it straight back if the stream dropped mid-claim. One
 * atomic claim, or a race seats a bot past its cap; the count, the cap and the
 * error factories stay with the caller, whose feature owns what “active” means —
 * a stream bot is capped alone, a house bot shares its cap with its whole pool.
 */
export async function seatBotInLobby(
    deps: { sessionManager: SessionManager, presence: BotSeatPresence },
    session: ServerGameSession,
    bot: AccountUserProfile,
    countActiveGames: (botProfileId: string) => number,
    errors: { offline(): ApiRequestError, capReached(): ApiRequestError, seatLost(): ApiRequestError },
    options: { maxGames?: number, displayName?: string } = {},
): Promise<string> {
    if (!deps.presence.isOnline(bot.id)) {
        /* No stream, no seat: the game start arrives on the stream. */
        throw errors.offline();
    }

    if (countActiveGames(bot.id) >= (options.maxGames ?? MAX_CONCURRENT_GAMES_PER_BOT)) {
        throw errors.capReached();
    }

    const socketId = deps.presence.getSocketId(bot.id);
    const participation = await deps.sessionManager.joinSession(session, {
        deviceId: socketId,
        profile: bot,
        /* A house bot's seat name carries its strength; a stream bot is just its name. */
        displayName: options.displayName ?? bot.username,
        allowSelfJoinCasualGames: true,
    });
    if (participation.role !== `player`) {
        /* Lost a race for the last seat: give the spectator row straight back, or it
         * would sit there forever with no socket to disconnect it. */
        await deps.sessionManager.leaveSession(session, participation.participant.id, `leave-session`);
        throw errors.seatLost();
    }

    deps.sessionManager.assignParticipantSocket(session, participation.participant.id, socketId);
    if (!deps.presence.isOnline(bot.id)) {
        /* The stream dropped mid-claim: the sweep would orphan the seat, but the
         * claimer should not wait the 30 s grace for that. */
        await deps.sessionManager.leaveSession(session, participation.participant.id, `leave-session`);
        throw errors.offline();
    }

    return participation.participant.id;
}
