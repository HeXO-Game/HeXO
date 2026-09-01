import type { LobbyInfo } from '@ih3t/shared';
import i18next from 'i18next'

type LobbyPlayerLike = {
    displayName: string
    elo: number | null
};

export function formatLobbyPlayers(
    players: readonly LobbyPlayerLike[],
    rated: boolean,
    emptyLabel = i18next.t('waitingForFirstPlayer', 'Waiting for first player'),
) {
    if (players.length === 0) {
        return emptyLabel;
    }

    return players
        .map((player) => rated ? i18next.t('displaynameElo', '{{displayName}} ({{elo}})', { displayName: player.displayName, elo: player.elo }) : player.displayName)
        .join(` vs `);
}

export function formatLobbyLiveDuration(startedAt: number | null, now: number) {
    if (!startedAt) {
        return null;
    }

    return formatActiveSessionDuration(startedAt, now);
}

export function formatActiveSessionDuration(startedAt: number, now: number) {
    const totalSeconds = Math.max(0, Math.round((now - startedAt) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return i18next.t('valval2', '{{val}}:{{val2}}', { val: String(minutes).padStart(2, `0`), val2: String(seconds).padStart(2, `0`) });
}

export function sortLobbySessions(sessions: LobbyInfo[]) {
    return sessions.sort((leftSession, rightSession) => {
        const leftCanJoin = leftSession.startedAt === null && leftSession.players.length < 2;
        const rightCanJoin = rightSession.startedAt === null && rightSession.players.length < 2;

        if (leftCanJoin !== rightCanJoin) {
            return leftCanJoin ? -1 : 1;
        }

        return (rightSession.startedAt ?? 0) - (leftSession.startedAt ?? 0);
    });
}
