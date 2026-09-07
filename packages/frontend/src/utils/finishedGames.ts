import type { FinishedGameSummary, SessionFinishReason } from '@ih3t/shared';
import i18next from 'i18next';

export type PersonalResultTone = `win` | `loss` | `neutral`;

type ResultLabelKey = `${SessionFinishReason}-${PersonalResultTone}`;

const RESULT_LABELS: Record<ResultLabelKey, () => string> = {
    'disconnect-neutral': () => i18next.t('wonByDisconnect', 'Won by disconnect'),
    'disconnect-win': () => i18next.t('wonByDisconnect', 'Won by disconnect'),
    'disconnect-loss': () => i18next.t('lostDueToDisconnect', 'Lost due to disconnect'),
    'draw-agreement-neutral': () => i18next.t('drawAgreed', 'Draw agreed'),
    'draw-agreement-win': () => i18next.t('drawAgreed', 'Draw agreed'),
    'draw-agreement-loss': () => i18next.t('drawAgreed', 'Draw agreed'),
    'surrender-neutral': () => i18next.t('wonBySurrender', 'Won by surrender'),
    'surrender-win': () => i18next.t('wonBySurrender', 'Won by surrender'),
    'surrender-loss': () => i18next.t('lostDueToSurrender', 'Lost due to surrender'),
    'timeout-neutral': () => i18next.t('wonOnTime', 'Won on time'),
    'timeout-win': () => i18next.t('wonOnTime', 'Won on time'),
    'timeout-loss': () => i18next.t('lostDueToTimeout', 'Lost due to timeout'),
    'terminated-neutral': () => i18next.t('matchTerminated', 'Match terminated'),
    'terminated-win': () => i18next.t('matchTerminated', 'Match terminated'),
    'terminated-loss': () => i18next.t('matchTerminated', 'Match terminated'),
    'six-in-a-row-neutral': () => i18next.t('wonBySixInARow', 'Won by six in a row'),
    'six-in-a-row-win': () => i18next.t('wonBySixInARow', 'Won by six in a row'),
    'six-in-a-row-loss': () => i18next.t('lostDueToSixInARow', 'Lost due to six in a row'),
};

function getResultLabel(reason: SessionFinishReason, tone: PersonalResultTone) {
    return RESULT_LABELS[`${reason}-${tone}`]();
}

export function getOwnPlayerId(game: FinishedGameSummary, currentProfileId: string | null) {
    if (!currentProfileId) {
        return null;
    }

    return game.players.find((player) => player.profileId === currentProfileId)?.playerId ?? null;
}

export function getNeutralResultLabel(game: FinishedGameSummary) {
    return getResultLabel(game.gameResult?.reason ?? `terminated`, `neutral`);
}

export function getPersonalResultLabel(game: FinishedGameSummary, currentProfileId: string | null) {
    const ownPlayerId = getOwnPlayerId(game, currentProfileId);
    const reason = game.gameResult?.reason ?? `terminated`;
    const winningPlayerId = game.gameResult?.winningPlayerId ?? null;

    if (reason === `draw-agreement`) {
        return {
            label: getResultLabel(reason, `neutral`),
            tone: `neutral` as const,
        };
    }

    if (!ownPlayerId || !winningPlayerId || !game.gameResult) {
        return {
            label: getResultLabel(reason, `neutral`),
            tone: `neutral` as const,
        };
    }

    const didWin = ownPlayerId === winningPlayerId;
    const tone = didWin ? `win` as const : `loss` as const;

    return {
        label: getResultLabel(reason, tone),
        tone,
    };
}
