import { expect, test } from '@playwright/experimental-ct-react';
import { createStartedGameState } from '@ih3t/shared';
import SandboxHud from './SandboxHud';
import SandboxPlacementPanel from './SandboxPlacementPanel';
import SandboxBoardPanel from './SandboxBoardPanel';
import SandboxPositionPanel from './SandboxPositionPanel';
import GameBoardView from '../game-screen/GameBoardView';
import { editSandboxCell } from '../../sandbox/sandboxPlacement';

test('one accordion exposes placement, board actions and bot controls', async ({ mount, page }) => {
    let action = '';
    await mount(<SandboxHud positionName={null}
        placementPanel={<SandboxPlacementPanel placementMode="turn" onPlacementModeChange={mode => { action = mode; }} />}
        boardPanel={<SandboxBoardPanel
            onResetBoard={() => { }} onResetView={() => { }} onUndo={() => { }} onRedo={() => { }}
            canUndo={false} canRedo={false} />}
        positionPanel={<SandboxPositionPanel hasPosition={false} onResetPosition={() => { }} canSharePosition
            onImportPosition={() => { action = 'import'; }} onSharePosition={() => { action = 'export'; }} />}
        botPanel={<button>Change engine</button>}
    />);
    await page.getByRole('button', { name: 'Placement', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Turn', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Toggle', exact: true }).click();
    await expect.poll(() => action).toBe('toggle');
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Position', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reset', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect.poll(() => action).toBe('import');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect.poll(() => action).toBe('export');
    await page.getByRole('button', { name: 'Bot', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Change engine' })).toBeVisible();
});

test('editing permits occupied-cell clicks even without a human turn', async ({ mount, page }) => {
    let clicks = 0;
    const state = editSandboxCell(createStartedGameState(['x', 'o'], 'x'), 'player-1', 0, 0, ['x', 'o']);
    await mount(<GameBoardView className="h-150 w-150" gameState={state} highlightedCells="last"
        localPlayerId={null} interactionEnabled editCells onPlaceCell={() => { clicks++; }} />);
    await page.locator('canvas').click({ position: { x: 300, y: 300 } });
    await expect.poll(() => clicks).toBe(1);
});


test('position controls keep import available alongside reset', async ({ mount, page }) => {
    let reset = false;
    await mount(<SandboxPositionPanel hasPosition onResetPosition={() => { reset = true; }}
        onImportPosition={() => { }} onSharePosition={() => { }} canSharePosition={false} />);
    await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect.poll(() => reset).toBe(true);
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
});
