import { getOrCreateDeviceId } from "../deviceId";
import { createTrackedHeaders } from "../openReplay";
import i18next from 'i18next'

let cachedDeviceId: string | null = null;

export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = `ApiError`;
    }
}

export function getApiBaseUrl() {
    const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
    if (configuredBaseUrl) {
        return configuredBaseUrl.replace(/\/$/, ``);
    }

    return window.location.origin;
}

export function getSocketUrl() {
    return import.meta.env.VITE_SOCKET_URL ?? getApiBaseUrl();
}

export function getDeviceId() {
    if (cachedDeviceId) {
        return cachedDeviceId;
    }

    cachedDeviceId = getOrCreateDeviceId();
    return cachedDeviceId;
}

export async function fetchJson<T>(
    path: string,
    init?: RequestInit,
): Promise<T> {
    const deviceId = getDeviceId();
    const headers = createTrackedHeaders(init?.headers);
    headers.set(`X-Device-Id`, deviceId);

    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        credentials: `include`,
        ...init,
        headers,
    });

    if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        const message =
            typeof data === `object` &&
            data &&
            `error` in data &&
            typeof data.error === `string`
                ? data?.error
                : i18next.t('requestFailedStatus', 'Request failed: {{status}}', { status: response.status });
        throw new ApiError(response.status, message);
    }

    return (await response.json()) as T;
}

export async function fetchOptionalJson<T>(
    path: string,
    init?: RequestInit,
): Promise<T | null> {
    try {
        return await fetchJson<T>(path, init);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            return null;
        }

        throw error;
    }
}
