import type { FinishedGameSummary } from '@ih3t/shared';
import { getResultLabel, type PersonalResultTone } from './sessionResult';

export type { PersonalResultTone } from './sessionResult';

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

    const tone: PersonalResultTone = reason === `draw-agreement` || !ownPlayerId || !winningPlayerId
        ? `neutral`
        : ownPlayerId === winningPlayerId ? `win` : `loss`;

    return { label: getResultLabel(reason, tone), tone };
}
