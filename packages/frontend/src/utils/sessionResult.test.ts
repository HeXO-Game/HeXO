import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FinishedGameSummary, SessionFinishReason } from '@ih3t/shared';

import i18next from '../i18n';
import { getNeutralResultLabel, getPersonalResultLabel } from './finishedGames';
import { getPlayerResultMessage, getResultLabel, getSessionFinishReasonSentenceLabel, getSpectatorResultMessage, getSpectatorResultTitle } from './sessionResult';

test('result text preserves perspectives, fallbacks, and language switching', async () => {
    const reasons: SessionFinishReason[] = ['six-in-a-row', 'surrender', 'timeout', 'disconnect', 'draw-agreement', 'terminated'];
    const originalLanguage = i18next.language;
    try {
        for (const lng of ['en', 'de', 'ko-KR', 'zh-CN', 'en']) {
            await i18next.changeLanguage(lng);
            for (const reason of reasons) {
                const shared = reason === 'draw-agreement' || reason === 'terminated';
                for (const variant of ['win', 'lose', 'draw'] as const) {
                    const message = getPlayerResultMessage(variant, reason);
                    assert.ok(message);
                    if (lng !== 'en') {
                        await i18next.changeLanguage('en');
                        assert.notEqual(message, getPlayerResultMessage(variant, reason));
                        await i18next.changeLanguage(lng);
                    }
                    if (shared) assert.equal(message, getPlayerResultMessage('win', reason));
                }
                assert.equal(getResultLabel(reason, 'neutral'), getResultLabel(reason, 'win'));
                if (!shared) {
                    assert.notEqual(getResultLabel(reason, 'win'), getResultLabel(reason, 'loss'));
                    assert.ok(getSpectatorResultMessage(reason, 'Test Winner').includes('Test Winner'));
                    assert.equal(getPlayerResultMessage('draw', reason), i18next.t('resultNoWinner'));
                }
                const game = {
                    players: [{ profileId: 'profile', playerId: 'one' }],
                    gameResult: { reason, winningPlayerId: 'one' },
                } as FinishedGameSummary;
                assert.equal(getPersonalResultLabel(game, 'profile').tone, reason === 'draw-agreement' ? 'neutral' : 'win');
                game.gameResult!.winningPlayerId = 'two';
                assert.equal(getPersonalResultLabel(game, 'profile').tone, reason === 'draw-agreement' ? 'neutral' : 'loss');
                assert.equal(getPersonalResultLabel(game, null).tone, 'neutral');
                assert.equal(getPersonalResultLabel(game, 'unknown').label, getNeutralResultLabel(game));
            }
            assert.equal(getSessionFinishReasonSentenceLabel(null), getSessionFinishReasonSentenceLabel('terminated'));
            assert.equal(getSpectatorResultMessage(undefined, null), getSpectatorResultMessage('terminated', null));
            assert.equal(getSpectatorResultTitle('draw-agreement', null), i18next.t('matchDrawn'));
            assert.equal(getSpectatorResultTitle(null, null), i18next.t('matchFinished'));
        }
    } finally {
        await i18next.changeLanguage(originalLanguage);
    }
});
