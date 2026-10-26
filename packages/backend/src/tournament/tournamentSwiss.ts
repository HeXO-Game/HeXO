import type {
    TournamentMatch,
    TournamentMatchSlot,
    TournamentParticipant,
    TournamentSeriesSettings,
    TournamentStanding,
    TournamentSwissTiebreaks,
} from '@ih3t/shared';

import { getPairingKey, selectSwissRoundPairing } from './tournamentSwissPairing';

type SeededSwissParticipant = TournamentParticipant & {
    seed: number;
};

type StandingEntry = {
    participant: TournamentParticipant;
    matchPoints: number;
    wins: number;
    losses: number;
    buchholz: number;
    sonnebornBerger: number;
    hadBye: boolean;
    isDropped: boolean;
    rank: number;
};

function createSwissSlot(participant: SeededSwissParticipant | null): TournamentMatchSlot {
    if (!participant) {
        return {
            source: null,
            profileId: null,
            displayName: `BYE`,
            image: null,
            seed: null,
            isBye: true,
        };
    }

    return {
        source: null,
        profileId: participant.profileId,
        displayName: participant.displayName,
        image: participant.image,
        seed: participant.seed,
        isBye: false,
    };
}

function createSwissMatch(
    round: number,
    order: number,
    bestOf: 1 | 3 | 5 | 7,
    slots: [TournamentMatchSlot, TournamentMatchSlot],
): TournamentMatch {
    return {
        id: `match-swiss-${round}-${order}`,
        bracket: `swiss`,
        round,
        order,
        state: `pending`,
        bestOf,
        slots,
        leftWins: 0,
        rightWins: 0,
        gameIds: [],
        sessionId: null,
        winnerProfileId: null,
        loserProfileId: null,
        resultType: null,
        currentGameNumber: 1,
        startedAt: null,
        resolvedAt: null,
        advanceWinnerTo: null,
        advanceLoserTo: null,
    };
}

function buildPlayedPairings(matches: TournamentMatch[]): Set<string> {
    const playedPairings = new Set<string>();
    for (const match of matches) {
        if (match.bracket !== `swiss` || match.state !== `completed`) {
            continue;
        }

        const [leftProfileId, rightProfileId] = match.slots.map((slot) => slot.profileId);
        if (!leftProfileId || !rightProfileId) {
            continue;
        }

        playedPairings.add(getPairingKey(leftProfileId, rightProfileId));
    }

    return playedPairings;
}

function buildPlayedPairingsByRound(matches: TournamentMatch[]): Map<number, Set<string>> {
    const byRound = new Map<number, Set<string>>();
    for (const match of matches) {
        if (match.bracket !== `swiss` || match.state !== `completed`) {
            continue;
        }

        const [leftProfileId, rightProfileId] = match.slots.map((slot) => slot.profileId);
        if (!leftProfileId || !rightProfileId) {
            continue;
        }

        const key = getPairingKey(leftProfileId, rightProfileId);
        const existing = byRound.get(match.round);
        if (existing) {
            existing.add(key);
        } else {
            byRound.set(match.round, new Set([key]));
        }
    }

    return byRound;
}

function pairParticipants(
    participants: SeededSwissParticipant[],
    playedPairings: Set<string>,
): [SeededSwissParticipant, SeededSwissParticipant][] | null {
    if (participants.length === 0) {
        return [];
    }

    const [firstParticipant, ...remainingParticipants] = participants;

    for (let index = 0; index < remainingParticipants.length; index += 1) {
        const candidate = remainingParticipants[index]!;
        if (playedPairings.has(getPairingKey(firstParticipant.profileId, candidate.profileId))) {
            continue;
        }

        const nextParticipants = remainingParticipants.filter((_, candidateIndex) => candidateIndex !== index);
        const remainingPairings = pairParticipants(nextParticipants, playedPairings);
        if (!remainingPairings) {
            continue;
        }

        return [
            [firstParticipant, candidate],
            ...remainingPairings,
        ];
    }

    return null;
}

function pairWithRelaxedRematches(
    orderedParticipants: SeededSwissParticipant[],
    standingByProfileId: Map<string, TournamentStanding>,
    existingMatches: TournamentMatch[],
): { byeParticipant: SeededSwissParticipant | null; pairings: [SeededSwissParticipant, SeededSwissParticipant][] } | null {
    const byeEligibleParticipantIndex = orderedParticipants.length % 2 === 1
        ? (() => {
            for (let index = orderedParticipants.length - 1; index >= 0; index -= 1) {
                const participant = orderedParticipants[index];
                const standing = standingByProfileId.get(participant.profileId);
                if (!standing?.hadBye) {
                    return index;
                }
            }

            return orderedParticipants.length - 1;
        })()
        : -1;

    const participantsForPairing = byeEligibleParticipantIndex >= 0
        ? orderedParticipants.filter((_, index) => index !== byeEligibleParticipantIndex)
        : orderedParticipants;
    const byeParticipant = byeEligibleParticipantIndex >= 0
        ? orderedParticipants[byeEligibleParticipantIndex] ?? null
        : null;

    const pairingsByRound = buildPlayedPairingsByRound(existingMatches);
    const rounds = [...pairingsByRound.keys()].sort((a, b) => a - b);
    for (let relaxCount = 0; relaxCount <= rounds.length; relaxCount += 1) {
        const relaxedRounds = new Set(rounds.slice(0, relaxCount));
        const constrainedPairings = new Set<string>();
        for (const [round, roundPairings] of pairingsByRound) {
            if (!relaxedRounds.has(round)) {
                for (const key of roundPairings) {
                    constrainedPairings.add(key);
                }
            }
        }

        const pairings = pairParticipants(participantsForPairing, constrainedPairings);
        if (pairings) {
            return { byeParticipant, pairings };
        }
    }

    return null;
}

type SwissGame = {
    opponentProfileId: string | null;
    won: boolean;
    /** False for byes, walkovers and double forfeits. */
    played: boolean;
};

/**
 * Ranks the given participants by match points, then Buchholz, Sonneborn-Berger, wins and seed.
 * Tiebreaks use the real results of every opponent, including opponents who later withdrew.
 * Withdrawn and disqualified players stay listed but rank after everyone who finished the event.
 *
 * With `fair` tiebreaks every unplayed round (bye, walkover, double forfeit) counts as a game
 * against an opponent with the player's own score, so receiving a bye or a forfeit no longer
 * lowers a player's Buchholz, and head-to-head results break remaining ties before seed.
 */
export function calculateSwissStandings(
    participants: TournamentParticipant[],
    matches: TournamentMatch[],
    tiebreaks: TournamentSwissTiebreaks = `classic`,
): TournamentStanding[] {
    const statsByProfileId = new Map<string, {
        wins: number;
        losses: number;
        opponents: string[];
        defeatedOpponents: string[];
        games: SwissGame[];
        hadBye: boolean;
    }>();
    const getStats = (profileId: string) => {
        let stats = statsByProfileId.get(profileId);
        if (!stats) {
            stats = { wins: 0, losses: 0, opponents: [], defeatedOpponents: [], games: [], hadBye: false };
            statsByProfileId.set(profileId, stats);
        }

        return stats;
    };

    const swissMatches = matches.filter((match) => match.bracket === `swiss` && match.state === `completed`);
    for (const match of swissMatches) {
        const slotProfileIds = match.slots.map((slot) => slot.profileId).filter((profileId): profileId is string => Boolean(profileId));
        if (match.resultType === `double-forfeit`) {
            // Nobody played, so both players take a loss and neither counts as the other's opponent.
            for (const profileId of slotProfileIds) {
                const stats = getStats(profileId);
                stats.losses += 1;
                stats.games.push({ opponentProfileId: null, won: false, played: false });
            }
            continue;
        }

        const played = match.resultType === `played`;
        if (slotProfileIds.length === 2) {
            const [leftProfileId, rightProfileId] = slotProfileIds;
            getStats(leftProfileId).opponents.push(rightProfileId);
            getStats(rightProfileId).opponents.push(leftProfileId);
            getStats(leftProfileId).games.push({ opponentProfileId: rightProfileId, won: match.winnerProfileId === leftProfileId, played });
            getStats(rightProfileId).games.push({ opponentProfileId: leftProfileId, won: match.winnerProfileId === rightProfileId, played });
        }

        if (match.resultType === `bye` && match.winnerProfileId) {
            const stats = getStats(match.winnerProfileId);
            stats.hadBye = true;
            stats.games.push({ opponentProfileId: null, won: true, played: false });
        }

        if (match.winnerProfileId) {
            const winnerStats = getStats(match.winnerProfileId);
            winnerStats.wins += 1;
            if (match.loserProfileId) {
                winnerStats.defeatedOpponents.push(match.loserProfileId);
            }
        }

        if (match.loserProfileId) {
            getStats(match.loserProfileId).losses += 1;
        }
    }

    const getWins = (profileId: string) => statsByProfileId.get(profileId)?.wins ?? 0;
    const getTiebreaks = (profileId: string) => {
        const stats = statsByProfileId.get(profileId);
        if (!stats) {
            return { buchholz: 0, sonnebornBerger: 0 };
        }

        if (tiebreaks === `classic`) {
            return {
                buchholz: stats.opponents.reduce((sum, opponentProfileId) => sum + getWins(opponentProfileId), 0),
                sonnebornBerger: stats.defeatedOpponents.reduce((sum, opponentProfileId) => sum + getWins(opponentProfileId), 0),
            };
        }

        const getOpponentScore = (game: SwissGame) => game.played && game.opponentProfileId ? getWins(game.opponentProfileId) : stats.wins;
        return {
            buchholz: stats.games.reduce((sum, game) => sum + getOpponentScore(game), 0),
            sonnebornBerger: stats.games.filter((game) => game.won).reduce((sum, game) => sum + getOpponentScore(game), 0),
        };
    };

    const sorted = participants
        .filter((participant) => participant.status !== `removed`)
        .map((participant) => {
            const stats = statsByProfileId.get(participant.profileId);
            const wins = stats?.wins ?? 0;
            return {
                participant,
                matchPoints: wins,
                wins,
                losses: stats?.losses ?? 0,
                ...getTiebreaks(participant.profileId),
                hadBye: stats?.hadBye ?? false,
                isDropped: participant.status === `dropped`,
                rank: 0,
            } satisfies StandingEntry;
        })
        .sort((left, right) =>
            Number(left.isDropped) - Number(right.isDropped)
            || right.matchPoints - left.matchPoints
            || right.buchholz - left.buchholz
            || right.sonnebornBerger - left.sonnebornBerger
            || right.wins - left.wins
            || (left.participant.seed ?? Number.MAX_SAFE_INTEGER) - (right.participant.seed ?? Number.MAX_SAFE_INTEGER)
            || left.participant.registeredAt - right.participant.registeredAt
            || left.participant.displayName.localeCompare(right.participant.displayName));
    const standings = tiebreaks === `fair` ? applyHeadToHead(sorted, swissMatches) : sorted;

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
        isDropped: entry.isDropped,
    }));
}

/**
 * Within each group of players still tied on points, Buchholz and Sonneborn-Berger, ranks players by
 * how many of the decided matches among the group they won. Ties within the group keep their order.
 */
function applyHeadToHead(sorted: StandingEntry[], matches: TournamentMatch[]): StandingEntry[] {
    const isTied = (left: StandingEntry, right: StandingEntry) => left.isDropped === right.isDropped
        && left.matchPoints === right.matchPoints
        && left.buchholz === right.buchholz
        && left.sonnebornBerger === right.sonnebornBerger;

    const result: StandingEntry[] = [];
    for (let start = 0; start < sorted.length;) {
        let end = start + 1;
        while (end < sorted.length && isTied(sorted[start]!, sorted[end]!)) {
            end += 1;
        }

        const group = sorted.slice(start, end);
        if (group.length > 1) {
            const members = new Set(group.map((entry) => entry.participant.profileId));
            const headToHeadWins = new Map<string, number>();
            for (const match of matches) {
                if (match.winnerProfileId && match.loserProfileId && members.has(match.winnerProfileId) && members.has(match.loserProfileId)) {
                    headToHeadWins.set(match.winnerProfileId, (headToHeadWins.get(match.winnerProfileId) ?? 0) + 1);
                }
            }

            group.sort((left, right) =>
                (headToHeadWins.get(right.participant.profileId) ?? 0) - (headToHeadWins.get(left.participant.profileId) ?? 0));
        }

        result.push(...group);
        start = end;
    }

    return result;
}

export function buildSwissRoundMatches(options: {
    participants: SeededSwissParticipant[];
    existingMatches: TournamentMatch[];
    round: number;
    totalRounds: number;
    seriesSettings: TournamentSeriesSettings;
    tiebreaks?: TournamentSwissTiebreaks;
}): TournamentMatch[] {
    const standings = calculateSwissStandings(options.participants, options.existingMatches, options.tiebreaks);
    const standingByProfileId = new Map(standings.map((standing) => [standing.profileId, standing] as const));
    const playedPairings = buildPlayedPairings(options.existingMatches);

    const orderedParticipants = [...options.participants].sort((left, right) => {
        if (options.round === 1) {
            return left.seed - right.seed;
        }

        const leftStanding = standingByProfileId.get(left.profileId);
        const rightStanding = standingByProfileId.get(right.profileId);
        return (leftStanding?.rank ?? Number.MAX_SAFE_INTEGER) - (rightStanding?.rank ?? Number.MAX_SAFE_INTEGER)
            || left.seed - right.seed;
    });

    const bestOf = options.round >= options.totalRounds
        ? options.seriesSettings.finalsBestOf
        : options.seriesSettings.earlyRoundsBestOf;
    const participantByProfileId = new Map(orderedParticipants.map((participant) => [participant.profileId, participant] as const));
    const selection = selectSwissRoundPairing({
        rankedProfileIds: orderedParticipants.map((participant) => participant.profileId),
        playedPairings,
        byeRecipients: new Set(standings.filter((standing) => standing.hadBye).map((standing) => standing.profileId)),
        roundsAfterThis: Math.max(0, options.totalRounds - options.round),
    });

    let byeParticipant: SeededSwissParticipant | null;
    let pairings: [SeededSwissParticipant, SeededSwissParticipant][];
    if (selection) {
        byeParticipant = selection.byeProfileId ? participantByProfileId.get(selection.byeProfileId) ?? null : null;
        pairings = selection.pairs.map(([left, right]) => [participantByProfileId.get(left)!, participantByProfileId.get(right)!]);
    } else {
        // Every possible pairing for this round repeats an earlier match. Allow rematches from the
        // oldest rounds first so players at least avoid their most recent opponents.
        const relaxed = pairWithRelaxedRematches(orderedParticipants, standingByProfileId, options.existingMatches);
        if (!relaxed) {
            return [];
        }

        ({ byeParticipant, pairings } = relaxed);
    }

    const matches = pairings.map(([leftParticipant, rightParticipant], index) => createSwissMatch(
        options.round,
        index + 1,
        bestOf,
        [
            createSwissSlot(leftParticipant),
            createSwissSlot(rightParticipant),
        ],
    ));

    if (byeParticipant) {
        matches.push(createSwissMatch(
            options.round,
            matches.length + 1,
            bestOf,
            [
                createSwissSlot(byeParticipant),
                createSwissSlot(null),
            ],
        ));
    }

    return matches;
}
