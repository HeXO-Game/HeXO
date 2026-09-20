import type { HouseBotsResponse } from '@ih3t/shared';
import { useQuery } from '@tanstack/react-query';

import { fetchOptionalJson } from './apiClient';
import { queryKeys } from './queryDefinitions';

/** The server's own opponents; null while BOT_API_ENABLED is off, because the route is not mounted. */
async function fetchHouseBots() {
    return await fetchOptionalJson<HouseBotsResponse>(`/api/house-bots`);
}

export function useQueryHouseBots(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: queryKeys.houseBots,
        queryFn: fetchHouseBots,
        enabled: options?.enabled,
        /* `available` moves as games start and end; a fresh look each time the lobby opens. */
        staleTime: 5 * 1000,
    });
}
