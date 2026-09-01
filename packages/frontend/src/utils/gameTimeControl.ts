import type { GameTimeControl } from '@ih3t/shared';
import i18next from 'i18next'

export function formatGameTimeSeconds(totalSeconds: number) {
    if (totalSeconds % 60 === 0) {
        return `${totalSeconds / 60}m`;
    }

    return i18next.t('totalsecondss', '{{totalSeconds}}s', { totalSeconds });
}

export function formatTimeControl(timeControl: GameTimeControl) {
    if (timeControl.mode === `unlimited`) {
        return `Unlimited`;
    }

    if (timeControl.mode === `turn`) {
        return i18next.t('turnVal', 'Turn {{val}}', { val: formatGameTimeSeconds(Math.round(timeControl.turnTimeMs / 1000)) });
    }

    return i18next.t('matchValVal2', 'Match {{val}} +{{val2}}', { val: formatGameTimeSeconds(Math.round(timeControl.mainTimeMs / 1000)), val2: formatGameTimeSeconds(Math.round(timeControl.incrementMs / 1000)) });
}

export function formatTimeControlDescription(timeControl: GameTimeControl) {
    if (timeControl.mode === `unlimited`) {
        return i18next.t('noClockIsConfiguredForThisLobby', 'No clock is configured for this lobby.');
    }

    if (timeControl.mode === `turn`) {
        return i18next.t('eachTurnIsConfiguredForVal', 'Each turn is configured for {{val}}.', { val: formatGameTimeSeconds(Math.round(timeControl.turnTimeMs / 1000)) });
    }

    return i18next.t('eachPlayerCanKeepUpToValTotalGainingVal2AfterEachCompletedTurn', 'Each player can keep up to {{val}} total, gaining {{val2}} after each completed turn.', { val: formatGameTimeSeconds(Math.round(timeControl.mainTimeMs / 1000)), val2: formatGameTimeSeconds(Math.round(timeControl.incrementMs / 1000)) });
}
