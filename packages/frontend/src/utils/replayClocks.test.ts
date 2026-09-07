import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FinishedGameRecord } from '@ih3t/shared';
import { getReplayClocks } from './replayClocks';

test('replay clocks charge placements and award increments only on completed turns', () => {
    const game = {
        startedAt: 0,
        players: [{ playerId: 'one' }, { playerId: 'two' }],
        gameOptions: { firstPlayer: 'host', timeControl: { mode: 'match', mainTimeMs: 60000, incrementMs: 5000 } },
        moves: [
            { playerId: 'one', x: 0, y: 0, timestamp: 10000 },
            { playerId: 'two', x: 1, y: 0, timestamp: 20000 },
            { playerId: 'two', x: 0, y: 1, timestamp: 25000 },
        ],
    } as FinishedGameRecord;
    assert.deepEqual(getReplayClocks(game, 0), { one: 60000, two: 60000 });
    assert.deepEqual(getReplayClocks(game, 1), { one: 55000, two: 60000 });
    assert.deepEqual(getReplayClocks(game, 2), { one: 55000, two: 50000 });
    assert.deepEqual(getReplayClocks(game, 3), { one: 55000, two: 50000 });
    game.gameOptions.timeControl = { mode: 'turn', turnTimeMs: 30000 };
    assert.deepEqual(getReplayClocks(game, 2), { one: 20000, two: 20000 });
    assert.deepEqual(getReplayClocks(game, 3), { one: 30000, two: 15000 });
    game.gameOptions.timeControl = { mode: 'unlimited' };
    assert.deepEqual(getReplayClocks(game, 3), { one: null, two: null });
});
