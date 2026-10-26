import type { TournamentMatch, TournamentParticipant, TournamentStanding } from '@ih3t/shared';

import { TOURNAMENTS_COLLECTION_NAME } from '../mongoCollections';
import type { DatabaseMigration } from './types';

/*
 * Completed tournaments used to have their standings recomputed on every view, so any change to
 * the ranking rules silently re-ranked past events. Tournaments now store their standings when
 * they complete. This migration captures the standings of already completed tournaments using a
 * frozen copy of the ranking rules that were in effect when they were played.
 */

type LegacyTournament = {
    id: string;
    format: `single-elimination` | `double-elimination` | `swiss`;
    status: string;
    startedAt: number | null;
    participants: TournamentParticipant[];
    matches: TournamentMatch[];
    finalStandings?: TournamentStanding[] | null;
};

type LegacyStanding = Omit<TournamentStanding, `isDropped`>;

type StandingEntry = {
    participant: TournamentParticipant;
    matchPoints: number;
    wins: number;
    losses: number;
    buchholz: number;
    sonnebornBerger: number;
    hadBye: boolean;
    rank: number;
};

/* ---- Frozen copy of the pre-2026-10 ranking rules. Do not change. ---- */

function calculateSwissStandings(
    participants: TournamentParticipant[],
    matches: TournamentMatch[],
): LegacyStanding[] {
    const activeParticipants = participants.filter((participant) => participant.status !== `removed` && participant.status !== `dropped`);
    const statsByProfileId = new Map<string, {
        participant: TournamentParticipant;
        wins: number;
        losses: number;
        opponents: string[];
        defeatedOpponents: string[];
        hadBye: boolean;
    }>(activeParticipants.map((participant) => [
        participant.profileId,
        {
            participant,
            wins: 0,
            losses: 0,
            opponents: [],
            defeatedOpponents: [],
            hadBye: false,
        },
    ]));

    for (const match of matches) {
        if (match.bracket !== `swiss` || match.state !== `completed`) {
            continue;
        }

        const slotProfileIds = match.slots.map((slot) => slot.profileId).filter((profileId): profileId is string => Boolean(profileId));
        if (slotProfileIds.length === 2) {
            const [leftProfileId, rightProfileId] = slotProfileIds;
            statsByProfileId.get(leftProfileId)?.opponents.push(rightProfileId);
            statsByProfileId.get(rightProfileId)?.opponents.push(leftProfileId);
        }

        if (match.resultType === `bye` && match.winnerProfileId) {
            const stats = statsByProfileId.get(match.winnerProfileId);
            if (stats) {
                stats.hadBye = true;
            }
        }

        if (match.winnerProfileId) {
            const winnerStats = statsByProfileId.get(match.winnerProfileId);
            if (winnerStats) {
                winnerStats.wins += 1;
                if (match.loserProfileId) {
                    winnerStats.defeatedOpponents.push(match.loserProfileId);
                }
            }
        }

        if (match.loserProfileId) {
            const loserStats = statsByProfileId.get(match.loserProfileId);
            if (loserStats) {
                loserStats.losses += 1;
            }
        }
    }

    const standings = activeParticipants.map((participant) => {
        const stats = statsByProfileId.get(participant.profileId);
        const wins = stats?.wins ?? 0;
        const losses = stats?.losses ?? 0;
        const opponents = stats?.opponents ?? [];
        const defeatedOpponents = stats?.defeatedOpponents ?? [];

        const buchholz = opponents.reduce((sum, opponentProfileId) =>
            sum + (statsByProfileId.get(opponentProfileId)?.wins ?? 0), 0);
        const sonnebornBerger = defeatedOpponents.reduce((sum, opponentProfileId) =>
            sum + (statsByProfileId.get(opponentProfileId)?.wins ?? 0), 0);

        return {
            participant,
            matchPoints: wins,
            wins,
            losses,
            buchholz,
            sonnebornBerger,
            hadBye: stats?.hadBye ?? false,
            rank: 0,
        } satisfies StandingEntry;
    }).sort((left, right) =>
        right.matchPoints - left.matchPoints
        || right.buchholz - left.buchholz
        || right.sonnebornBerger - left.sonnebornBerger
        || right.wins - left.wins
        || (left.participant.seed ?? Number.MAX_SAFE_INTEGER) - (right.participant.seed ?? Number.MAX_SAFE_INTEGER)
        || left.participant.registeredAt - right.participant.registeredAt
        || left.participant.displayName.localeCompare(right.participant.displayName));

    return standings.map((entry, index) => ({
        rank: index + 1,
        profileId: entry.participant.profileId,
        displayName: entry.participant.displayName,
        image: entry.participant.image,
        matchPoints: entry.matchPoints,
        wins: entry.wins,
        losses: entry.losses,
        buchholz: entry.buchholz,
        sonnebornBerger: entry.sonnebornBerger,
        hadBye: entry.hadBye,
    }));
}

function isPreStartLeaver(p: TournamentParticipant, tournament: LegacyTournament): boolean {
    if (p.removedAt === null) return false;
    if (tournament.startedAt === null) return true;
    return p.removedAt < tournament.startedAt;
}

function getLegacyStandings(tournament: LegacyTournament): LegacyStanding[] {
    const standingsParticipants = tournament.participants.filter(
        (p) => p.status !== `removed` && !isPreStartLeaver(p, tournament),
    );

    if (tournament.format === `swiss`) {
        return calculateSwissStandings(standingsParticipants, tournament.matches);
    }

    return calculateEliminationStandings(tournament, standingsParticipants);
}

function calculateEliminationStandings(tournament: LegacyTournament, activeParticipants = tournament.participants.filter((p) => p.status !== `removed`)): LegacyStanding[] {

    // Count wins/losses per player
    const winsByProfile = new Map<string, number>();
    const lossesByProfile = new Map<string, number>();
    // Track the highest round a player lost in (higher round = better placement)
    // For DE: track losers bracket round too
    const eliminationRound = new Map<string, { bracket: string; round: number }>();

    for (const match of tournament.matches) {
        if (match.state !== `completed`) continue;

        if (match.resultType !== `bye` && match.winnerProfileId) {
            winsByProfile.set(match.winnerProfileId, (winsByProfile.get(match.winnerProfileId) ?? 0) + 1);
        }
        if (match.loserProfileId) {
            lossesByProfile.set(match.loserProfileId, (lossesByProfile.get(match.loserProfileId) ?? 0) + 1);
            // Record elimination point (last loss = where they were knocked out)
            eliminationRound.set(match.loserProfileId, { bracket: match.bracket, round: match.round });
        }
    }

    // Find the grand final / final match winner
    const grandFinalReset = tournament.matches.find((m) => m.bracket === `grand-final-reset` && m.state === `completed`);
    const grandFinal = tournament.matches.find((m) => m.bracket === `grand-final` && m.state === `completed`);
    const finalMatch = grandFinalReset ?? grandFinal;

    // For SE: final match is the highest round in winners bracket
    const winnersMatches = tournament.matches.filter((m) => m.bracket === `winners`);
    const maxWinnersRound = winnersMatches.reduce((max, m) => Math.max(max, m.round), 0);
    const seFinal = winnersMatches.find((m) => m.round === maxWinnersRound && m.state === `completed`);

    const championId = tournament.format === `double-elimination`
        ? finalMatch?.winnerProfileId ?? null
        : seFinal?.winnerProfileId ?? null;

    const runnerUpId = tournament.format === `double-elimination`
        ? finalMatch?.loserProfileId ?? null
        : seFinal?.loserProfileId ?? null;
    const thirdPlaceMatch = tournament.matches.find((match) => match.bracket === `third-place` && match.state === `completed`) ?? null;
    const thirdPlaceWinnerId = thirdPlaceMatch?.winnerProfileId ?? null;
    const fourthPlaceId = thirdPlaceMatch?.loserProfileId ?? null;

    // Assign placement scores — higher is better
    // For SE: eliminated in round R of total T rounds → placement group = T - R + 1
    //   Round T (final) loser = 2nd, Round T-1 (semi) losers = 3rd, etc.
    // For DE: losers bracket players are ranked below winners bracket same-round losers
    //   Grand final loser = 2nd
    //   Last losers round loser = 3rd
    //   Then by losers bracket round (descending), then winners bracket round (descending)

    const losersMatches = tournament.matches.filter((m) => m.bracket === `losers`);
    const maxLosersRound = losersMatches.reduce((max, m) => Math.max(max, m.round), 0);

    function getPlacementScore(profileId: string): number {
        if (profileId === championId) return Number.MAX_SAFE_INTEGER;
        if (profileId === runnerUpId) return Number.MAX_SAFE_INTEGER - 1;
        if (profileId === thirdPlaceWinnerId) return Number.MAX_SAFE_INTEGER - 2;
        if (profileId === fourthPlaceId) return Number.MAX_SAFE_INTEGER - 3;

        const elim = eliminationRound.get(profileId);
        if (!elim) return 0; // dropped/DQ'd before playing

        if (tournament.format === `single-elimination`) {
            // Higher round = better placement
            return elim.round;
        }

        // Double elimination: losers bracket finishers ranked below same-level winners bracket
        if (elim.bracket === `losers`) {
            return elim.round; // losers round number
        }
        // Eliminated from winners bracket (sent to losers) — but then eliminated from losers
        // Their final elimination is in losers bracket, handled above
        // If they were only eliminated once from winners (shouldn't happen in DE completed), treat as winners round
        return maxLosersRound + elim.round;
    }

    const standings: LegacyStanding[] = activeParticipants.map((p) => ({
        rank: 0,
        profileId: p.profileId,
        displayName: p.displayName,
        image: p.image,
        matchPoints: 0,
        wins: winsByProfile.get(p.profileId) ?? 0,
        losses: lossesByProfile.get(p.profileId) ?? 0,
        buchholz: 0,
        sonnebornBerger: 0,
        hadBye: false,
    }));

    // Sort by placement score descending, then wins descending
    standings.sort((a, b) => {
        const scoreA = getPlacementScore(a.profileId);
        const scoreB = getPlacementScore(b.profileId);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return b.wins - a.wins;
    });

    // Assign ranks — tied placement scores get the same rank
    let currentRank = 1;
    for (let i = 0; i < standings.length; i++) {
        if (i > 0) {
            const prevScore = getPlacementScore(standings[i - 1].profileId);
            const currScore = getPlacementScore(standings[i].profileId);
            if (currScore !== prevScore) {
                currentRank = i + 1;
            }
        }
        standings[i].rank = currentRank;
    }

    return standings;
}

export const tournamentFinalStandingsMigration: DatabaseMigration = {
    id: `013-tournament-final-standings`,
    description: `Capture the final standings of completed tournaments`,
    async up({ database }) {
        const collection = database.collection<LegacyTournament>(TOURNAMENTS_COLLECTION_NAME);
        const completed = collection.find({
            status: `completed`,
            $or: [{ finalStandings: { $exists: false } }, { finalStandings: null }],
        });

        for await (const tournament of completed) {
            const droppedProfileIds = new Set(tournament.participants
                .filter((participant) => participant.status === `dropped`)
                .map((participant) => participant.profileId));
            const finalStandings = getLegacyStandings(tournament).map((standing) => ({
                ...standing,
                isDropped: droppedProfileIds.has(standing.profileId),
            }));
            await collection.updateOne({ id: tournament.id }, { $set: { finalStandings } });
        }
    },
};
