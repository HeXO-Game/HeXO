import { tracker } from '@openreplay/tracker';
import trackerAssist from '@openreplay/tracker-assist';
import { Params } from 'react-router';

import { APP_VERSION_HASH } from './appVersion';

type OpenReplayUser = {
    id: string;
    username: string;
};

type TrackerSingleton = typeof tracker;
type OpenReplayErrorMetadata = Record<string, string | number | boolean | null | undefined>;
type PendingTrackedError = {
    error: Error;
    metadata?: OpenReplayErrorMetadata;
};

let trackerSingleton: TrackerSingleton | null = null;
let trackedUser: OpenReplayUser | null = null;
let openReplayConfigured = false;
let openReplayStarting = false;
let openReplayStarted = false;
const pendingTrackedErrors: PendingTrackedError[] = [];
const MAX_PENDING_TRACKED_ERRORS = 20;

function isBrowser(): boolean {
    return typeof window !== `undefined` && typeof document !== `undefined`;
}

function normalizeTrackedError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }

    if (typeof error === `string`) {
        return new Error(error);
    }

    try {
        return new Error(JSON.stringify(error));
    } catch {
        return new Error(String(error));
    }
}

function flushPendingTrackedErrors(): void {
    if (!trackerSingleton || !openReplayStarted || pendingTrackedErrors.length === 0) {
        return;
    }

    for (const pendingError of pendingTrackedErrors.splice(0)) {
        trackerSingleton.handleError(pendingError.error, pendingError.metadata);
    }
}

export function createTrackedHeaders(init?: HeadersInit): Headers {
    const headers = new Headers(init);
    const sessionId = trackerSingleton?.getSessionID();
    if (sessionId) {
        headers.set(`X-OpenReplay-SessionId`, sessionId);
    }

    return headers;
}

function applyTrackedUser(): void {
    if (!trackerSingleton || !trackedUser) {
        return;
    }

    trackerSingleton.setUserID(trackedUser.id);
    trackerSingleton.setMetadata(`username`, trackedUser.username);
}

export function trackOpenReplayUser(user: OpenReplayUser | null): void {
    trackedUser = user;
    applyTrackedUser();
}

export function trackNavigation(targetUrl: string, params: Params<string>): void {
    const payload = { targetUrl, params };
    trackerSingleton?.event(`page_navigate`, payload);
    trackerSingleton?.analytics?.track(`page_navigate`, payload);
}

export function trackOpenReplayError(error: unknown, metadata?: OpenReplayErrorMetadata): void {
    if (!openReplayConfigured) {
        return;
    }

    const normalizedError = normalizeTrackedError(error);
    if (trackerSingleton && openReplayStarted) {
        trackerSingleton.handleError(normalizedError, metadata);
        return;
    }

    pendingTrackedErrors.push({
        error: normalizedError,
        metadata,
    });
    if (pendingTrackedErrors.length > MAX_PENDING_TRACKED_ERRORS) {
        pendingTrackedErrors.splice(0, pendingTrackedErrors.length - MAX_PENDING_TRACKED_ERRORS);
    }
}

export function initializeOpenReplay(): void {
    if (!isBrowser()) {
        return;
    }

    if (openReplayStarting || openReplayStarted) {
        return;
    }

    const projectKey = import.meta.env.VITE_OPENREPLAY_PROJECT_KEY?.trim();
    const ingestPoint = import.meta.env.VITE_OPENREPLAY_INGEST_POINT?.trim();
    if (!projectKey) {
        return;
    }

    openReplayConfigured = true;
    openReplayStarting = true;
    trackerSingleton = tracker;

    tracker.configure({
        projectKey,
        ingestPoint,

        revID: APP_VERSION_HASH,

        /* else requestAnimationFrame will constantly be called */
        capturePerformance: false,

        /* do not capture the games canvas */
        canvas: {
            disableCanvas: true,
        },

        analytics: {
            active: true,
        },
    });

    tracker.use(trackerAssist());

    void tracker.start().then(() => {
        openReplayStarting = false;
        openReplayStarted = true;
        applyTrackedUser();
        flushPendingTrackedErrors();
    }).catch(error => {
        trackerSingleton = null;
        openReplayStarting = false;
        console.error(`Failed to initialize OpenReplay`, error);
    });
}
