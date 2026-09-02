import type { FinishedGameRecord, FinishedGamesPage } from '@ih3t/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchJson } from './apiClient';
import { queryClient } from './queryClient';
import {
    FINISHED_GAMES_PAGE_SIZE,
    type FinishedGamesArchiveView,
    type FinishedGamesRatedFilter,
    queryKeys,
} from './queryDefinitions';


async function fetchFinishedGames(
    page: number,
    pageSize: number,
    baseTimestamp: number,
    view: FinishedGamesArchiveView,
    ratedFilter: FinishedGamesRatedFilter,
) {
    const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        baseTimestamp: String(baseTimestamp),
    });
    if (view === `mine`) {
        params.set(`view`, view);
    }
    if (ratedFilter !== `all`) {
        params.set(`rated`, ratedFilter);
    }

    return await fetchJson<FinishedGamesPage>(`/api/finished-games?${params.toString()}`);
}

async function fetchFinishedGame(gameId: string) {
    return await fetchJson<FinishedGameRecord>(`/api/finished-games/${encodeURIComponent(gameId)}`);
}

async function fetchPublicProfileGames(
    profileId: string,
    page: number,
    baseTimestamp: number,
    ratedFilter: FinishedGamesRatedFilter,
) {
    const params = new URLSearchParams({
        page: String(page),
        pageSize: `10`,
        baseTimestamp: String(baseTimestamp),
    });
    if (ratedFilter !== `all`) {
        params.set(`rated`, ratedFilter);
    }

    return await fetchJson<FinishedGamesPage>(
        `/api/profiles/${encodeURIComponent(profileId)}/games?${params.toString()}`,
    );
}

export async function invalidateFinishedGames() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.finishedGames });
}

export function useQueryFinishedGames(
    page: number,
    baseTimestamp: number,
    view: FinishedGamesArchiveView,
    ratedFilter: FinishedGamesRatedFilter,
    options?: { enabled?: boolean },
) {
    return useQuery({
        queryKey: queryKeys.finishedGamesPage(view, ratedFilter, page, FINISHED_GAMES_PAGE_SIZE, baseTimestamp),
        queryFn: () => fetchFinishedGames(page, FINISHED_GAMES_PAGE_SIZE, baseTimestamp, view, ratedFilter),
        placeholderData: keepPreviousData,
        enabled: options?.enabled,
        staleTime: 60 * 60 * 1000,
    });
}

export function useQueryFinishedGame(gameId: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: queryKeys.finishedGame(gameId),
        queryFn: () => {
            if (!gameId) {
                throw new Error(`Missing finished game id.`);
            }

            return fetchFinishedGame(gameId);
        },
        enabled: Boolean(gameId) && options?.enabled,
        staleTime: 60 * 60 * 1000,
    });
}

export function useQueryPublicProfileGames(
    profileId: string | null,
    page = 1,
    baseTimestamp = Date.now(),
    ratedFilter: FinishedGamesRatedFilter = `all`,
) {
    return useQuery({
        queryKey: [...queryKeys.profileRecentGames(profileId), page, ratedFilter],
        queryFn: () => {
            if (!profileId) {
                throw new Error(`Missing profile id.`);
            }

            return fetchPublicProfileGames(profileId, page, baseTimestamp, ratedFilter);
        },
        enabled: Boolean(profileId),
        staleTime: 60 * 1000,
    });
}
