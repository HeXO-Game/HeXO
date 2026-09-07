import type { SessionFinishReason, SessionPlayer, SessionStateFinished } from '@ih3t/shared';
import i18next from 'i18next'

export function getSpectatorRematchStatus(players: SessionPlayer[], state: SessionStateFinished) {
    const connectedPlayers = players.filter(player => player.connection.status !== `disconnected`);
    const requestingPlayers = players.filter(player => state.rematchAcceptedPlayerIds.includes(player.id));

    if (state.finishReason === `terminated`) {
        return {
            label: i18next.t('rematchUnavailable', 'Rematch Unavailable'),
            message: i18next.t('thisResultDoesNotSupportARematch', 'This result does not support a rematch.'),
            className: `border-white/12 bg-white/7 text-slate-100`,
            accentClassName: `text-white/70`,
        };
    } else if (connectedPlayers.length === 0) {
        return {
            label: i18next.t('rematchUnavailable', 'Rematch Unavailable'),
            message: i18next.t('bothPlayersLeftTheSession', 'Both players left the session.'),
            className: `border-rose-200/20 bg-rose-400/10 text-rose-50`,
            accentClassName: `text-rose-100/80`,
        };
    } else if (connectedPlayers.length !== players.length) {
        return {
            label: i18next.t('rematchUnavailable', 'Rematch Unavailable'),
            message: i18next.t('onePlayerLeftTheSession', 'One player left the session.'),
            className: `border-rose-200/20 bg-rose-400/10 text-rose-50`,
            accentClassName: `text-rose-100/80`,
        };
    } else if (requestingPlayers.length === 0) {
        return {
            label: i18next.t('rematchAvailable', 'Rematch Available'),
            message: i18next.t('noOneHasAskedForARematchYet', 'No one has asked for a rematch yet.'),
            className: `border-white/12 bg-white/7 text-slate-100`,
            accentClassName: `text-white/70`,
        };
    } else if (requestingPlayers.length < players.length) {
        const rematchRequestLabel = requestingPlayers[0]?.displayName?.trim() || i18next.t('aPlayer', 'A player');
        return {
            label: i18next.t('rematchRequested', 'Rematch Requested'),
            message: i18next.t('rematchrequestlabelWantToPlayAnotherRound', '{{rematchRequestLabel}} want to play another round.', { rematchRequestLabel }),
            className: `border-emerald-200/20 bg-emerald-400/10 text-emerald-50`,
            accentClassName: `text-emerald-100/80`,
        };
    } else {
        return {
            label: i18next.t('rematchStarting', 'Rematch Starting'),
            message: i18next.t('bothPlayersAcceptedTheRematch', 'Both players accepted the rematch.'),
            className: `border-sky-200/20 bg-sky-400/10 text-sky-50`,
            accentClassName: `text-sky-100/80`,
        };
    }
}

export type PersonalResultTone = `win` | `loss` | `neutral`;

type ResultText = {
    reason: string
    label: string
    lossLabel?: string
    message: string
    lossMessage?: string
    spectator: string
};

const RESULTS: Record<SessionFinishReason, (winningPlayerLabel: string) => ResultText> = {
    'six-in-a-row': (winningPlayerLabel) => ({
        reason: i18next.t('sixInARow2', 'Six in a row'),
        label: i18next.t('wonBySixInARow', 'Won by six in a row'),
        lossLabel: i18next.t('lostDueToSixInARow', 'Lost due to six in a row'),
        message: i18next.t('resultYouCompletedSix', 'You completed a six-tile row.'),
        lossMessage: i18next.t('resultOpponentCompletedSix', 'The other player completed a six-tile row.'),
        spectator: i18next.t('winningplayerlabelConnectedSixHexagonsInARow', '{{winningPlayerLabel}} connected six hexagons in a row.', { winningPlayerLabel }),
    }),
    'surrender': (winningPlayerLabel) => ({
        reason: i18next.t('finishReasonSurrender', 'Surrender'),
        label: i18next.t('wonBySurrender', 'Won by surrender'),
        lossLabel: i18next.t('lostDueToSurrender', 'Lost due to surrender'),
        message: i18next.t('resultOpponentSurrendered', 'The other player surrendered.'),
        lossMessage: i18next.t('resultYouSurrendered', 'You surrendered the match.'),
        spectator: i18next.t('winningplayerlabelWonAfterTheOtherPlayerSurrendered', '{{winningPlayerLabel}} won after the other player surrendered.', { winningPlayerLabel }),
    }),
    'timeout': (winningPlayerLabel) => ({
        reason: i18next.t('finishReasonTimeout', 'Timeout'),
        label: i18next.t('wonOnTime', 'Won on time'),
        lossLabel: i18next.t('lostDueToTimeout', 'Lost due to timeout'),
        message: i18next.t('resultOpponentTimedOut', 'The other player ran out of time.'),
        lossMessage: i18next.t('resultYouTimedOut', 'You ran out of time.'),
        spectator: i18next.t('winningplayerlabelWonOnTimeAfterTheOtherPlayerRanOutOfTime', '{{winningPlayerLabel}} won on time after the other player ran out of time.', { winningPlayerLabel }),
    }),
    'disconnect': (winningPlayerLabel) => ({
        reason: i18next.t('finishReasonDisconnect', 'Disconnect'),
        label: i18next.t('wonByDisconnect', 'Won by disconnect'),
        lossLabel: i18next.t('lostDueToDisconnect', 'Lost due to disconnect'),
        message: i18next.t('resultOpponentDisconnected', 'The other player disconnected.'),
        lossMessage: i18next.t('resultYouLeft', 'You left the match before it finished.'),
        spectator: i18next.t('winningplayerlabelWonAfterTheOtherPlayerDisconnected', '{{winningPlayerLabel}} won after the other player disconnected.', { winningPlayerLabel }),
    }),
    'draw-agreement': () => ({
        reason: i18next.t('draw', 'Draw'),
        label: i18next.t('drawAgreed', 'Draw agreed'),
        message: i18next.t('resultDrawAgreed', 'Both players agreed to a draw.'),
        spectator: i18next.t('bothPlayersAgreedToEndTheMatchInADraw', 'Both players agreed to end the match in a draw.'),
    }),
    'terminated': () => ({
        reason: i18next.t('finishReasonTerminated', 'Terminated'),
        label: i18next.t('matchTerminated', 'Match terminated'),
        message: i18next.t('resultTerminated', 'The match has been terminated.'),
        spectator: i18next.t('theMatchWasTerminatedBeforeAWinnerCouldBeDeclared', 'The match was terminated before a winner could be declared.'),
    }),
};

function getResultText(reason: SessionFinishReason | null | undefined, winnerName?: string | null) {
    return RESULTS[reason ?? `terminated`](winnerName ?? i18next.t('aPlayer', 'A player'));
}

export function getResultLabel(reason: SessionFinishReason, tone: PersonalResultTone) {
    const result = getResultText(reason);
    return tone === `loss` ? result.lossLabel ?? result.label : result.label;
}

export function getSessionFinishReasonSentenceLabel(reason: SessionFinishReason | null | undefined) {
    return getResultText(reason).reason;
}

export function getSessionFinishReasonLabel(reason: SessionFinishReason | null | undefined) {
    return reason === `six-in-a-row`
        ? i18next.t('sixInARow', 'Six In A Row')
        : getSessionFinishReasonSentenceLabel(reason);
}

export function getPlayerResultMessage(variant: `win` | `lose` | `draw`, reason: SessionFinishReason) {
    const result = getResultText(reason);
    if (variant === `draw` && reason !== `draw-agreement` && reason !== `terminated`) {
        return i18next.t('resultNoWinner', 'The match ended without a winner.');
    }
    return variant === `lose` ? result.lossMessage ?? result.message : result.message;
}

export function getSpectatorResultTitle(reason: SessionFinishReason | null | undefined, winnerName: string | null) {
    return winnerName
        ? i18next.t('winnernameWon', '{{winnerName}} Won', { winnerName })
        : reason === `draw-agreement`
            ? i18next.t('matchDrawn', 'Match Drawn')
            : i18next.t('matchFinished', 'Match Finished');
}

export function getSpectatorResultMessage(reason: SessionFinishReason | null | undefined, winnerName: string | null) {
    return getResultText(reason, winnerName).spectator;
}
