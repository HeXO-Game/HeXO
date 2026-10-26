/*
 * Swiss round pairing with lookahead.
 *
 * Pairing a round greedily (best pairing for this round only) can leave the remaining
 * rounds without any rematch-free pairing, which is what forced four rematches into the
 * last two rounds of a 9-player, 9-round event. Before committing to a round, we therefore
 * verify that the rounds after it can still be paired without rematches, and fall back to
 * the next pairing in preference order when they cannot.
 *
 * Preference order is unchanged from the plain greedy pairing: players are ranked, the bye
 * goes to the lowest-ranked player who has not had one, and each player in rank order is
 * paired with the nearest-ranked opponent they have not played yet.
 */

/** Upper bound on search steps per lookahead depth, which keeps pairing fast for any field size. */
const kSearchBudget = 200_000;

/**
 * Larger fields cannot run out of new opponents within the swiss round limit (15), so checking
 * that the following round stays pairable is enough and keeps pairing cheap for big events.
 */
const kFullLookaheadMaxPlayers = 64;

/** Remembering infeasible states only pays off for small fields, where the search can be exhaustive. */
const kMemoMaxPlayers = 24;

export type SwissRoundPairing = {
    byeProfileId: string | null;
    pairs: [string, string][];
};

/**
 * Search state over player indices, where index 0 is the best-ranked player.
 * `played[a * playerCount + b]` is 1 when players `a` and `b` already met (or are paired in the
 * pairing being built).
 */
type Search = {
    readonly playerCount: number;
    readonly played: Uint8Array;
    budget: number;
    readonly infeasible: Set<string>;
};

export function getPairingKey(leftProfileId: string, rightProfileId: string) {
    return leftProfileId < rightProfileId
        ? `${leftProfileId}:${rightProfileId}`
        : `${rightProfileId}:${leftProfileId}`;
}

/**
 * Largest number of rounds a field can play without any rematch: a full round robin.
 * Odd fields need one extra round because somebody sits out each round.
 */
export function getMaxRematchFreeSwissRounds(playerCount: number): number {
    if (playerCount < 2) {
        return 1;
    }

    return playerCount % 2 === 0 ? playerCount - 1 : playerCount;
}

/**
 * @param rankedProfileIds players to pair, best-ranked first
 * @param playedPairings pairing keys of every earlier swiss match
 * @param byeRecipients players who already received a bye
 * @param roundsAfterThis rounds still to be played after the one being paired
 */
export function selectSwissRoundPairing(options: {
    rankedProfileIds: string[];
    playedPairings: ReadonlySet<string>;
    byeRecipients: ReadonlySet<string>;
    roundsAfterThis: number;
}): SwissRoundPairing | null {
    const { rankedProfileIds, playedPairings } = options;
    const playerCount = rankedProfileIds.length;
    const played = new Uint8Array(playerCount * playerCount);
    for (let left = 0; left < playerCount; left += 1) {
        for (let right = left + 1; right < playerCount; right += 1) {
            if (playedPairings.has(getPairingKey(rankedProfileIds[left]!, rankedProfileIds[right]!))) {
                played[left * playerCount + right] = 1;
                played[right * playerCount + left] = 1;
            }
        }
    }

    const byeRecipients = new Uint8Array(playerCount);
    rankedProfileIds.forEach((profileId, index) => {
        byeRecipients[index] = options.byeRecipients.has(profileId) ? 1 : 0;
    });

    const maxFutureRounds = Math.max(0, getMaxRematchFreeSwissRounds(playerCount) - 1);
    const lookaheadLimit = playerCount > kFullLookaheadMaxPlayers ? 1 : maxFutureRounds;

    // Guarantee as many future rounds as possible: try the full lookahead first and shorten it
    // only if no pairing allows that many rematch-free rounds (or proving it gets too expensive).
    for (let depth = Math.min(options.roundsAfterThis, maxFutureRounds, lookaheadLimit); depth >= 0; depth -= 1) {
        const search: Search = { playerCount, played: played.slice(), budget: kSearchBudget, infeasible: new Set() };
        const pairing = findRoundPairing(search, byeRecipients, depth);
        if (pairing) {
            return {
                byeProfileId: pairing.bye === null ? null : rankedProfileIds[pairing.bye]!,
                pairs: pairing.pairs.map(([left, right]) => [rankedProfileIds[left]!, rankedProfileIds[right]!]),
            };
        }
    }

    return null;
}

function getAllPlayers(search: Search): number[] {
    return Array.from({ length: search.playerCount }, (_, index) => index);
}

/** Bye candidates for a pool sorted best-ranked first: lowest-ranked without a bye first. */
function getByeCandidates(pool: number[], byeRecipients: Uint8Array): (number | null)[] {
    if (pool.length % 2 === 0) {
        return [null];
    }

    const lowestRankedFirst = [...pool].reverse();
    const withoutBye = lowestRankedFirst.filter((player) => byeRecipients[player] === 0);
    return withoutBye.length > 0 ? withoutBye : lowestRankedFirst;
}

function withBye(byeRecipients: Uint8Array, player: number | null): Uint8Array {
    if (player === null) {
        return byeRecipients;
    }

    const next = byeRecipients.slice();
    next[player] = 1;
    return next;
}

function setPlayed(search: Search, left: number, right: number, value: 0 | 1) {
    search.played[left * search.playerCount + right] = value;
    search.played[right * search.playerCount + left] = value;
}

function hasPlayed(search: Search, left: number, right: number): boolean {
    return search.played[left * search.playerCount + right] === 1;
}

function findRoundPairing(
    search: Search,
    byeRecipients: Uint8Array,
    lookaheadRounds: number,
): { bye: number | null; pairs: [number, number][] } | null {
    const allPlayers = getAllPlayers(search);
    for (const bye of getByeCandidates(allPlayers, byeRecipients)) {
        const pool = bye === null ? allPlayers : allPlayers.filter((player) => player !== bye);
        const nextByeRecipients = withBye(byeRecipients, bye);

        let selected: [number, number][] | null = null;
        enumeratePreferredPairings(search, pool, [], (pairs) => {
            if (lookaheadRounds > 0 && !canScheduleRounds(search, allPlayers, nextByeRecipients, lookaheadRounds)) {
                return false;
            }

            selected = pairs.map(([left, right]) => [left, right]);
            return true;
        });

        if (selected) {
            return { bye, pairs: selected };
        }

        if (search.budget < 0) {
            return null;
        }
    }

    return null;
}

/**
 * Visits rematch-free pairings of `pool` in preference order: the first remaining player is
 * paired with the nearest-ranked opponent they have not met. The pairs of the pairing being
 * built are marked as played while `onComplete` runs. Stops as soon as `onComplete` returns true.
 */
function enumeratePreferredPairings(
    search: Search,
    pool: number[],
    pairs: [number, number][],
    onComplete: (pairs: [number, number][]) => boolean,
): boolean {
    if (pool.length === 0) {
        return onComplete(pairs);
    }

    const [first, ...rest] = pool;
    for (let index = 0; index < rest.length; index += 1) {
        if (--search.budget < 0) {
            return false;
        }

        const opponent = rest[index]!;
        if (hasPlayed(search, first!, opponent)) {
            continue;
        }

        setPlayed(search, first!, opponent, 1);
        pairs.push([first!, opponent]);
        const done = enumeratePreferredPairings(search, rest.filter((_, candidateIndex) => candidateIndex !== index), pairs, onComplete);
        pairs.pop();
        setPlayed(search, first!, opponent, 0);
        if (done) {
            return true;
        }
    }

    return false;
}

/** Whether `rounds` more rounds can be paired without any rematch and without anyone getting a second bye needlessly. */
function canScheduleRounds(
    search: Search,
    players: number[],
    byeRecipients: Uint8Array,
    rounds: number,
): boolean {
    if (rounds === 0) {
        return true;
    }

    const stateKey = search.playerCount <= kMemoMaxPlayers ? `${rounds}|${byeRecipients.join(``)}|${search.played.join(``)}` : null;
    if (stateKey !== null && search.infeasible.has(stateKey)) {
        return false;
    }

    for (const bye of getByeCandidates(players, byeRecipients)) {
        const pool = bye === null ? players : players.filter((player) => player !== bye);
        const nextByeRecipients = withBye(byeRecipients, bye);
        const found = findAnyMatching(search, pool, () =>
            canScheduleRounds(search, players, nextByeRecipients, rounds - 1));
        if (found) {
            return true;
        }

        if (search.budget < 0) {
            return false;
        }
    }

    if (stateKey !== null) {
        search.infeasible.add(stateKey);
    }
    return false;
}

/** Depth-first search over perfect matchings, always pairing the most constrained player next. */
function findAnyMatching(
    search: Search,
    pool: number[],
    onComplete: () => boolean,
): boolean {
    if (pool.length === 0) {
        return onComplete();
    }

    let mostConstrained = pool[0]!;
    let fewestOptions = Number.POSITIVE_INFINITY;
    for (const player of pool) {
        let options = 0;
        for (const other of pool) {
            if (other !== player && !hasPlayed(search, player, other)) {
                options += 1;
            }
        }

        if (options < fewestOptions) {
            fewestOptions = options;
            mostConstrained = player;
        }
    }

    if (fewestOptions === 0) {
        return false;
    }

    const rest = pool.filter((player) => player !== mostConstrained);
    for (const opponent of rest) {
        if (--search.budget < 0) {
            return false;
        }

        if (hasPlayed(search, mostConstrained, opponent)) {
            continue;
        }

        setPlayed(search, mostConstrained, opponent, 1);
        const done = findAnyMatching(search, rest.filter((player) => player !== opponent), onComplete);
        setPlayed(search, mostConstrained, opponent, 0);
        if (done) {
            return true;
        }
    }

    return false;
}
