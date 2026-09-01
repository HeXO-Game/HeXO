import type {
    FinishedGameRecord,
    FinishedGameSummary,
    GameTimeControl,
    LobbyInfo,
    LobbyListParticipant,
    SessionInfo,
    SessionPlayer,
} from '@ih3t/shared';

import { DEFAULT_PAGE_TITLE } from '../components/PageMetadata';
import i18next from 'i18next'

function formatPlayerLabel(player: LobbyListParticipant) {
    const normalizedName = player.displayName.trim() || i18next.t('aPlayer', 'A player');
    return player.elo > 0 ? i18next.t('normalizednameEloElo', '{{normalizedName}} ({{elo}} ELO)', { normalizedName, elo: player.elo }) : normalizedName;
}

function formatSessionPlayerLabel(player: SessionPlayer) {
    const normalizedName = player.displayName.trim() || i18next.t('aPlayer', 'A player');
    return player.rating.eloScore > 0 ? i18next.t('normalizednameEloscoreElo', '{{normalizedName}} ({{eloScore}} ELO)', { normalizedName, eloScore: player.rating.eloScore }) : normalizedName;
}

export function formatTimeControl(timeControl: GameTimeControl): string {
    if (timeControl.mode === `unlimited`) {
        return `no`;
    }

    const formatSeconds = (totalSeconds: number): string => {
        if (totalSeconds % 60 === 0) {
            return `${totalSeconds / 60}m`;
        }

        return i18next.t('totalsecondss', '{{totalSeconds}}s', { totalSeconds });
    };

    if (timeControl.mode === `turn`) {
        return i18next.t('valTurnBased', '{{val}} turn based', { val: formatSeconds(Math.round(timeControl.turnTimeMs / 1000)) });
    }

    return i18next.t('valVal2ClockBased', '{{val}} +{{val2}} clock based', { val: formatSeconds(Math.round(timeControl.mainTimeMs / 1000)), val2: formatSeconds(Math.round(timeControl.incrementMs / 1000)) });
}

export function describeLobbyInvite(session: LobbyInfo | null) {
    if (!session) {
        return {
            title: i18next.t('inviteExpiredDefault_page_title', 'Invite Expired • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE }),
            description: i18next.t('thisLiveSessionIsNoLongerActiveOpenTheLobbyToHostOrJoinAnotherMatch', 'This live session is no longer active. Open the lobby to host or join another match.'),
            robots: 'noindex, nofollow' as const,
        };
    }

    const canJoin = session.startedAt === null && session.players.length < 2;
    const inviteModeLabel = session.rated ? `Rated` : `Casual`;
    const playerLabels = session.players.map(formatPlayerLabel);

    if (canJoin) {
        const waitingLabel = playerLabels[0]
            ? i18next.t('valIsWaitingForYou', '{{val}} is waiting for you', { val: playerLabels[0] })
            : i18next.t('aLobbyIsWaitingForYou', 'A lobby is waiting for you');

        return {
            title: i18next.t('joinInvitemodelabelLobbyIdDefault_page_title', 'Join {{inviteModeLabel}} Lobby {{id}} • {{DEFAULT_PAGE_TITLE}}', { inviteModeLabel, id: session.id, DEFAULT_PAGE_TITLE }),
            description: i18next.t('waitinglabelWithValTimeControlClickToJoinTheMatch', '{{waitingLabel}} with {{val}} time control. Click to join the match.', { waitingLabel, val: formatTimeControl(session.timeControl) }),
            robots: 'noindex, nofollow' as const,
        };
    }

    const matchLabel = playerLabels.length >= 2
        ? i18next.t('valAndVal2AreAlreadyPlaying', '{{val}} and {{val2}} are already playing', { val: playerLabels[0], val2: playerLabels[1] })
        : playerLabels[0]
            ? i18next.t('valIsAlreadyPlaying', '{{val}} is already playing', { val: playerLabels[0] })
            : i18next.t('aMatchIsAlreadyUnderway', 'A match is already underway');

    return {
        title: i18next.t('spectateInvitemodelabelMatchIdDefault_page_title', 'Spectate {{inviteModeLabel}} Match {{id}} • {{DEFAULT_PAGE_TITLE}}', { inviteModeLabel, id: session.id, DEFAULT_PAGE_TITLE }),
        description: i18next.t('matchlabelWithValTimeControlOpenToSpectateItLive', '{{matchLabel}} with {{val}} time control. Open to spectate it live.', { matchLabel, val: formatTimeControl(session.timeControl) }),
        robots: 'noindex, nofollow' as const,
    };
}

export function describeSessionInvite(session: SessionInfo | null) {
    if (!session) {
        return {
            title: i18next.t('inviteExpiredDefault_page_title', 'Invite Expired • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE }),
            description: i18next.t('thisLiveSessionIsNoLongerActiveOpenTheLobbyToHostOrJoinAnotherMatch', 'This live session is no longer active. Open the lobby to host or join another match.'),
            robots: 'noindex, nofollow' as const,
        };
    }

    const inviteModeLabel = session.gameOptions.rated ? `Rated` : `Casual`;
    const playerLabels = session.players.map(formatSessionPlayerLabel);

    if (session.state.status === `lobby` && session.players.length < 2) {
        const waitingLabel = playerLabels[0]
            ? i18next.t('valIsWaitingForYou', '{{val}} is waiting for you', { val: playerLabels[0] })
            : i18next.t('aLobbyIsWaitingForYou', 'A lobby is waiting for you');

        return {
            title: i18next.t('joinInvitemodelabelLobbyIdDefault_page_title', 'Join {{inviteModeLabel}} Lobby {{id}} • {{DEFAULT_PAGE_TITLE}}', { inviteModeLabel, id: session.id, DEFAULT_PAGE_TITLE }),
            description: i18next.t('waitinglabelWithValTimeControlClickToJoinTheMatch', '{{waitingLabel}} with {{val}} time control. Click to join the match.', { waitingLabel, val: formatTimeControl(session.gameOptions.timeControl) }),
            robots: 'noindex, nofollow' as const,
        };
    }

    if (session.state.status === `finished`) {
        const matchLabel = playerLabels.length >= 2
            ? i18next.t('valAndVal2FinishedTheirMatch', '{{val}} and {{val2}} finished their match', { val: playerLabels[0], val2: playerLabels[1] })
            : playerLabels[0]
                ? i18next.t('valFinishedTheirMatch', '{{val}} finished their match', { val: playerLabels[0] })
                : i18next.t('aMatchHasAlreadyFinished', 'A match has already finished');

        return {
            title: i18next.t('finishedMatchIdDefault_page_title', 'Finished Match {{id}} • {{DEFAULT_PAGE_TITLE}}', { id: session.id, DEFAULT_PAGE_TITLE }),
            description: i18next.t('matchlabelWithValTimeControlOpenTheLiveBoardToReviewTheFinalPosition', '{{matchLabel}} with {{val}} time control. Open the live board to review the final position.', { matchLabel, val: formatTimeControl(session.gameOptions.timeControl) }),
            robots: 'noindex, nofollow' as const,
        };
    }

    const matchLabel = playerLabels.length >= 2
        ? i18next.t('valAndVal2AreAlreadyPlaying', '{{val}} and {{val2}} are already playing', { val: playerLabels[0], val2: playerLabels[1] })
        : playerLabels[0]
            ? i18next.t('valIsAlreadyPlaying', '{{val}} is already playing', { val: playerLabels[0] })
            : i18next.t('aMatchIsAlreadyUnderway', 'A match is already underway');

    return {
        title: i18next.t('spectateInvitemodelabelMatchIdDefault_page_title', 'Spectate {{inviteModeLabel}} Match {{id}} • {{DEFAULT_PAGE_TITLE}}', { inviteModeLabel, id: session.id, DEFAULT_PAGE_TITLE }),
        description: i18next.t('matchlabelWithValTimeControlOpenToSpectateItLive', '{{matchLabel}} with {{val}} time control. Open to spectate it live.', { matchLabel, val: formatTimeControl(session.gameOptions.timeControl) }),
        robots: 'noindex, nofollow' as const,
    };
}

export function formatFinishReason(reason: string | null | undefined): string {
    switch (reason) {
        case `six-in-a-row`:
            return i18next.t('withASixinarowWin', 'with a six-in-a-row win');
        case `disconnect`:
            return i18next.t('afterADisconnect', 'after a disconnect');
        case `surrender`:
            return i18next.t('afterASurrender', 'after a surrender');
        case `timeout`:
            return i18next.t('afterATimeout', 'after a timeout');
        case `terminated`:
            return i18next.t('whenTheSessionWasTerminated', 'when the session was terminated');
        default:
            return i18next.t('afterTheMatchEnded', 'after the match ended');
    }
}

export function describeFinishedGameMetadata(
    game: FinishedGameRecord | FinishedGameSummary,
    isOwnReplay: boolean,
) {
    const replayLabel = isOwnReplay ? `My Replay` : `Replay`;

    return {
        title: i18next.t('replaylabelSessionidDefault_page_title', '{{replayLabel}} {{sessionId}} • {{DEFAULT_PAGE_TITLE}}', { replayLabel, sessionId: game.sessionId, DEFAULT_PAGE_TITLE }),
        description: i18next.t('reviewValMatchSessionidMovecountMovesLengthPlayersEndedVal2', 'Review {{val}} match {{sessionId}}: {{moveCount}} moves, {{length}} players, ended {{val2}}.', { val: isOwnReplay ? `your` : `finished`, sessionId: game.sessionId, moveCount: game.moveCount, length: game.players.length, val2: formatFinishReason(game.gameResult?.reason) }),
        ogType: `article` as const,
        robots: isOwnReplay ? 'noindex, nofollow' as const : `index, follow` as const,
    };
}

export function formatSandboxPlayerLabel(player: `player-1` | `player-2`): string {
    return player === `player-1` ? `Player 1` : `Player 2`;
}

export function formatPlacementSummary(placementsRemaining: number): string {
    return i18next.t('countPlacementsRemaining', { defaultValue_one: '1 placement remaining', defaultValue_other: '{{count}} placements remaining', count: placementsRemaining });
}
