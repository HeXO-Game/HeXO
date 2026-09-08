import type {
    AccountPreferences,
    AccountPreferencesResponse,
    AccountResponse,
    BotAccountsResponse,
    BotAccountTokenResponse,
    CreateBotAccountRequest,
    ProfileResponse,
    ProfileStatisticsResponse,
    UpdateAccountPreferencesRequest,
    UpdateAccountProfileRequest,
} from "@ih3t/shared";
import { useQuery } from "@tanstack/react-query";

import { fetchJson, fetchOptionalJson } from "./apiClient";
import { queryClient } from "./queryClient";
import { queryKeys } from "./queryDefinitions";

async function fetchAccount() {
    return await fetchJson<AccountResponse>(`/api/account`);
}

async function fetchProfile(profileId: string) {
    return await fetchJson<ProfileResponse>(
        `/api/profiles/${encodeURIComponent(profileId)}`,
    );
}

async function fetchAccountPreferences() {
    return await fetchJson<AccountPreferencesResponse>(
        `/api/account/preferences`,
    );
}

async function fetchProfileStatistics(profileId: string) {
    return await fetchJson<ProfileStatisticsResponse>(
        `/api/profiles/${encodeURIComponent(profileId)}/statistics`,
    );
}

export async function updateAccountProfile(
    update: UpdateAccountProfileRequest,
) {
    return await fetchJson<AccountResponse>(`/api/account`, {
        method: `PATCH`,
        headers: {
            "Content-Type": `application/json`,
        },
        body: JSON.stringify(update),
    });
}

export async function updateAccountUsername(username: string) {
    return await updateAccountProfile({
        username,
    } satisfies UpdateAccountProfileRequest);
}

export async function updateAccountPreferences(
    preferences: Partial<AccountPreferences>,
) {
    const response = await fetchJson<AccountPreferencesResponse>(
        `/api/account/preferences`,
        {
            method: `PATCH`,
            headers: {
                "Content-Type": `application/json`,
            },
            body: JSON.stringify({
                preferences,
            } satisfies UpdateAccountPreferencesRequest),
        },
    );

    queryClient.setQueryData(queryKeys.accountPreferences, response);
    return response;
}

export function useQueryAccount(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: queryKeys.account,
        queryFn: fetchAccount,
        enabled: options?.enabled,
        staleTime: 10 * 60 * 1000,
    });
}

export function useQueryAccountPreferences(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: queryKeys.accountPreferences,
        queryFn: fetchAccountPreferences,
        enabled: options?.enabled,
        staleTime: 10 * 60 * 1000,
    });
}

export function useQueryProfile(
    profileId: string | null,
    options?: { enabled?: boolean },
) {
    return useQuery({
        queryKey: queryKeys.profile(profileId),
        queryFn: () => {
            if (!profileId) {
                throw new Error(`Missing profile id.`);
            }

            return fetchProfile(profileId);
        },
        enabled: Boolean(profileId) && options?.enabled,
        staleTime: 10 * 60 * 1000,
    });
}

export function useQueryProfileStatistics(
    profileId: string | null,
    options?: { enabled?: boolean },
) {
    return useQuery({
        queryKey: queryKeys.profileStatistics(profileId),
        queryFn: () => {
            if (!profileId) {
                throw new Error(`Missing profile id.`);
            }

            return fetchProfileStatistics(profileId);
        },
        enabled: Boolean(profileId) && options?.enabled,
        staleTime: 60 * 1000,
    });
}

/** Resolves to null while BOT_API_ENABLED is off, because the routes are not mounted. */
async function fetchAccountBots() {
    return await fetchOptionalJson<BotAccountsResponse>(`/api/account/bots`);
}

export function useQueryAccountBots(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: queryKeys.accountBots,
        queryFn: fetchAccountBots,
        enabled: options?.enabled,
    });
}

export async function createAccountBot(username: string) {
    const response = await fetchJson<BotAccountTokenResponse>(`/api/account/bots`, {
        method: `POST`,
        headers: {
            "Content-Type": `application/json`,
        },
        body: JSON.stringify({ username } satisfies CreateBotAccountRequest),
    });

    await queryClient.invalidateQueries({ queryKey: queryKeys.accountBots });
    return response;
}

export async function rotateAccountBotToken(botId: string) {
    const response = await fetchJson<BotAccountTokenResponse>(
        `/api/account/bots/${encodeURIComponent(botId)}/token`,
        { method: `POST` },
    );

    await queryClient.invalidateQueries({ queryKey: queryKeys.accountBots });
    return response;
}

export async function deleteAccountBot(botId: string) {
    const response = await fetchJson<BotAccountsResponse>(
        `/api/account/bots/${encodeURIComponent(botId)}`,
        { method: `DELETE` },
    );

    queryClient.setQueryData(queryKeys.accountBots, response);
    return response;
}

