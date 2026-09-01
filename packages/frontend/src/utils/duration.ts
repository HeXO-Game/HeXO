import i18next from 'i18next'
function getTotalSeconds(milliseconds: number, roundMode: `ceil` | `round` = `round`) {
    const round = roundMode === `ceil` ? Math.ceil : Math.round;
    return Math.max(0, round(milliseconds / 1000));
}

export function formatMinutesSeconds(milliseconds: number | null, nullLabel = `--:--`) {
    if (milliseconds === null) {
        return nullLabel;
    }

    const totalSeconds = getTotalSeconds(milliseconds, `ceil`);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, `0`)}`;
}

export function formatCompactDuration(milliseconds: number) {
    const totalSeconds = getTotalSeconds(milliseconds);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) {
        return `${seconds}s`;
    }

    return i18next.t('minutesmSecondss', '{{minutes}}m {{seconds}}s', { minutes, seconds });
}

export function formatDetailedDuration(milliseconds: number) {
    const totalSeconds = getTotalSeconds(milliseconds);
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return i18next.t('hourshMinutesmSecondss', '{{hours}}h {{minutes}}m {{seconds}}s', { hours, minutes, seconds });
    }

    if (minutes > 0) {
        return i18next.t('minutesmSecondss', '{{minutes}}m {{seconds}}s', { minutes, seconds });
    }

    return `${seconds}s`;
}

export function formatLongDuration(milliseconds: number) {
    const totalSeconds = getTotalSeconds(milliseconds);
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
        return i18next.t('daysdHourshMinutesm', '{{days}}d {{hours}}h {{minutes}}m', { days, hours, minutes });
    }

    if (hours > 0) {
        return i18next.t('hourshMinutesmSecondss', '{{hours}}h {{minutes}}m {{seconds}}s', { hours, minutes, seconds });
    }

    if (minutes > 0) {
        return i18next.t('minutesmSecondss', '{{minutes}}m {{seconds}}s', { minutes, seconds });
    }

    return `${seconds}s`;
}

export function formatCountdownDuration(milliseconds: number) {
    const totalSeconds = getTotalSeconds(milliseconds, `ceil`);
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return i18next.t('hourshValmVal2s', '{{hours}}h {{val}}m {{val2}}s', { hours, val: String(minutes).padStart(2, `0`), val2: String(seconds).padStart(2, `0`) });
    }

    return i18next.t('minutesmVals', '{{minutes}}m {{val}}s', { minutes, val: String(seconds).padStart(2, `0`) });
}

export function formatRefreshCountdown(milliseconds: number) {
    if (milliseconds <= 0) {
        return `Refreshing now`;
    }

    const totalSeconds = getTotalSeconds(milliseconds, `ceil`);
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return i18next.t('hourshValm', '{{hours}}h {{val}}m', { hours, val: String(minutes).padStart(2, `0`) });
    }

    return `${minutes}:${String(seconds).padStart(2, `0`)}`;
}

export function formatBucketSize(bucketSizeMs: number) {
    const totalMinutes = Math.round(bucketSizeMs / 60_000);
    return i18next.t('totalminutesminute', '{{totalMinutes}}-minute', { totalMinutes });
}
