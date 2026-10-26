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

export type SwissRoundPairing = {
    byeProfileId: string | null;
    pairs: [string, string][];
};

type Search = {
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
    const { rankedProfileIds, playedPairings, byeRecipients } = options;
    const maxFutureRounds = Math.max(0, getMaxRematchFreeSwissRounds(rankedProfileIds.length) - 1);

    // Guarantee as many future rounds as possible: try the full lookahead first and shorten it
    // only if no pairing allows that many rematch-free rounds (or proving it gets too expensive).
    for (let depth = Math.min(options.roundsAfterThis, maxFutureRounds); depth >= 0; depth -= 1) {
        const search: Search = { budget: kSearchBudget, infeasible: new Set() };
        const pairing = findRoundPairing(rankedProfileIds, playedPairings, byeRecipients, depth, search);
        if (pairing) {
            return pairing;
        }
    }

    return null;
}

function getByeCandidates(rankedProfileIds: string[], byeRecipients: ReadonlySet<string>): (string | null)[] {
    if (rankedProfileIds.length % 2 === 0) {
        return [null];
    }

    const lowestRankedFirst = [...rankedProfileIds].reverse();
    const withoutBye = lowestRankedFirst.filter((profileId) => !byeRecipients.has(profileId));
    return withoutBye.length > 0 ? withoutBye : lowestRankedFirst;
}

function findRoundPairing(
    rankedProfileIds: string[],
    playedPairings: ReadonlySet<string>,
    byeRecipients: ReadonlySet<string>,
    lookaheadRounds: number,
    search: Search,
): SwissRoundPairing | null {
    for (const byeProfileId of getByeCandidates(rankedProfileIds, byeRecipients)) {
        const pool = byeProfileId === null
            ? rankedProfileIds
            : rankedProfileIds.filter((profileId) => profileId !== byeProfileId);
        const played = new Set(playedPairings);
        const nextByeRecipients = byeProfileId === null ? byeRecipients : new Set([...byeRecipients, byeProfileId]);

        let selected: [string, string][] | null = null;
        enumeratePreferredPairings(pool, played, [], search, (pairs) => {
            if (lookaheadRounds > 0 && !canScheduleRounds(rankedProfileIds, played, nextByeRecipients, lookaheadRounds, search)) {
                return false;
            }

            selected = pairs.map(([left, right]) => [left, right]);
            return true;
        });

        if (selected) {
            return { byeProfileId, pairs: selected };
        }

        if (search.budget < 0) {
            return null;
        }
    }

    return null;
}

/**
 * Visits rematch-free pairings of `pool` in preference order: the first remaining player is
 * paired with the nearest-ranked opponent they have not met. `played` contains the pairs of the
 * pairing being built while `onComplete` runs. Stops as soon as `onComplete` returns true.
 */
function enumeratePreferredPairings(
    pool: string[],
    played: Set<string>,
    pairs: [string, string][],
    search: Search,
    onComplete: (pairs: [string, string][]) => boolean,
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
        const key = getPairingKey(first!, opponent);
        if (played.has(key)) {
            continue;
        }

        played.add(key);
        pairs.push([first!, opponent]);
        const done = enumeratePreferredPairings(rest.filter((_, candidateIndex) => candidateIndex !== index), played, pairs, search, onComplete);
        pairs.pop();
        played.delete(key);
        if (done) {
            return true;
        }
    }

    return false;
}

/** Whether `rounds` more rounds can be paired without any rematch and without anyone getting a second bye needlessly. */
function canScheduleRounds(
    profileIds: string[],
    played: Set<string>,
    byeRecipients: ReadonlySet<string>,
    rounds: number,
    search: Search,
): boolean {
    if (rounds === 0) {
        return true;
    }

    const stateKey = getStateKey(profileIds, played, byeRecipients, rounds);
    if (search.infeasible.has(stateKey)) {
        return false;
    }

    for (const byeProfileId of getByeCandidates(profileIds, byeRecipients)) {
        const pool = byeProfileId === null ? profileIds : profileIds.filter((profileId) => profileId !== byeProfileId);
        const nextByeRecipients = byeProfileId === null ? byeRecipients : new Set([...byeRecipients, byeProfileId]);
        const found = findAnyMatching(pool, played, search, () =>
            canScheduleRounds(profileIds, played, nextByeRecipients, rounds - 1, search));
        if (found) {
            return true;
        }

        if (search.budget < 0) {
            return false;
        }
    }

    search.infeasible.add(stateKey);
    return false;
}

/** Depth-first search over perfect matchings, always pairing the most constrained player next. */
function findAnyMatching(
    pool: string[],
    played: Set<string>,
    search: Search,
    onComplete: () => boolean,
): boolean {
    if (pool.length === 0) {
        return onComplete();
    }

    let mostConstrained = pool[0]!;
    let fewestOptions = Number.POSITIVE_INFINITY;
    for (const profileId of pool) {
        let options = 0;
        for (const other of pool) {
            if (other !== profileId && !played.has(getPairingKey(profileId, other))) {
                options += 1;
            }
        }

        if (options < fewestOptions) {
            fewestOptions = options;
            mostConstrained = profileId;
        }
    }

    if (fewestOptions === 0) {
        return false;
    }

    const rest = pool.filter((profileId) => profileId !== mostConstrained);
    for (const opponent of rest) {
        if (--search.budget < 0) {
            return false;
        }

        const key = getPairingKey(mostConstrained, opponent);
        if (played.has(key)) {
            continue;
        }

        played.add(key);
        const done = findAnyMatching(rest.filter((profileId) => profileId !== opponent), played, search, onComplete);
        played.delete(key);
        if (done) {
            return true;
        }
    }

    return false;
}

function getStateKey(profileIds: string[], played: Set<string>, byeRecipients: ReadonlySet<string>, rounds: number): string {
    const active = new Set(profileIds);
    const relevantPairs = [...played]
        .filter((key) => {
            const [left, right] = key.split(`:`);
            return active.has(left!) && active.has(right!);
        })
        .sort();
    const relevantByes = [...byeRecipients].filter((profileId) => active.has(profileId)).sort();
    return `${rounds}|${relevantByes.join(`,`)}|${relevantPairs.join(`,`)}`;
}
