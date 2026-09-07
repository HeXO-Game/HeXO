import type { CreateSandboxPositionResponse, SandboxPositionResponse } from '@ih3t/shared';
import { expect, test } from '@playwright/experimental-ct-react';
import type { SandboxImportPosition } from '../../sandbox/sandboxNotation';
import SandboxImportModal from './SandboxImportModal';
import SandboxShareModal from './SandboxShareModal';
import SandboxWelcomeModal from './SandboxWelcomeModal';
import SandboxBotFactoryModal from './SandboxBotFactoryModal';

const position: SandboxPositionResponse = {
    id: 'abc1234',
    name: 'Opening',
    gamePosition: { cells: [], currentTurnPlayer: 'player-1', placementsRemaining: 1 },
};

test('all sandbox dialogs follow open and reset forms on reopening', async ({ mount, page }) => {
    const modals = (open: boolean) => <>
        <SandboxWelcomeModal open={open} onStartCleanBoard={() => {}} onImportPosition={() => {}} />
        <SandboxImportModal open={false} onClose={() => {}} onImport={() => {}} />
        <SandboxShareModal open={false} initialName={null} gamePosition={position.gamePosition} onClose={() => {}} onCreate={() => {}} />
        <SandboxBotFactoryModal open={false} selectedEngine={null} onClose={() => {}} onSelectBotFactory={() => {}} />
    </>;
    const component = await mount(modals(false));
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await component.update(modals(true));
    await expect(page.getByRole('dialog', { name: 'Local Free Play' })).toBeVisible();
    await expect(page.getByText('Sandbox Mode', { exact: true })).toHaveCount(0);
    await component.update(modals(false));
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await component.unmount();

    let closeCount = 0;
    const importModal = (open: boolean) => <SandboxImportModal open={open} onClose={() => { closeCount++; }} onImport={() => {}} />;
    const importer = await mount(importModal(true));
    await page.getByRole('textbox').fill('abc1234');
    await page.keyboard.press('Escape');
    await expect.poll(() => closeCount).toBe(1);
    await importer.update(importModal(false));
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await importer.update(importModal(true));
    await expect(page.getByRole('textbox')).toHaveValue('');
    await importer.unmount();

    const shareModal = (open: boolean) => <SandboxShareModal open={open} initialName="Opening" gamePosition={position.gamePosition} onClose={() => {}} onCreate={() => {}} />;
    const sharer = await mount(shareModal(true));
    await page.getByRole('textbox').fill('Changed');
    await sharer.update(shareModal(false));
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await sharer.update(shareModal(true));
    await expect(page.getByRole('textbox')).toHaveValue('Opening');
    await sharer.unmount();

    const picker = await mount(<SandboxBotFactoryModal open selectedEngine={null} onClose={() => {}} onSelectBotFactory={() => {}} />);
    await expect(page.getByRole('dialog', { name: 'Choose an engine' })).toBeVisible();
    await picker.update(<SandboxBotFactoryModal open={false} selectedEngine={null} onClose={() => {}} onSelectBotFactory={() => {}} />);
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('import validates links, reports failures, and returns the loaded position', async ({ mount, page }) => {
    let imported: SandboxImportPosition | null = null;
    await page.route('**/api/sandbox-positions/abc1234', route => route.fulfill({
        status: 404, json: { error: 'Position missing' },
    }));
    await mount(<SandboxImportModal open onClose={() => {}} onImport={value => { imported = value; }} />);
    const input = page.getByRole('textbox');
    await input.fill('invalid-id');
    await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
    await input.fill('https://example.com/sandbox/ABC1234');
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.getByText('Position missing')).toBeVisible();
    await page.route('**/api/sandbox-positions/abc1234', route => route.fulfill({ json: position }));
    await input.fill('abc1234');
    await expect(page.getByText('Position missing')).toHaveCount(0);
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect.poll(() => imported).toEqual(position);
});

test('share creates a named position and copies its link', async ({ mount, page, context }) => {
    let created: CreateSandboxPositionResponse | null = null;
    let request: unknown;
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.route('**/api/sandbox-positions', route => {
        request = route.request().postDataJSON();
        return route.fulfill({ json: { id: position.id, name: position.name } });
    });
    await mount(<SandboxShareModal
        open
        gamePosition={position.gamePosition}
        initialName={null}
        onClose={() => {}}
        onCreate={value => { created = value; }}
    />);
    await expect(page.getByRole('button', { name: 'Create Link' })).toBeDisabled();
    await page.getByRole('textbox').fill(' Opening ');
    await page.getByRole('button', { name: 'Create Link' }).click();
    await expect.poll(() => created).toEqual({ id: position.id, name: position.name });
    expect(request).toEqual({ name: position.name, gamePosition: position.gamePosition });
    const url = await page.getByRole('textbox').inputValue();
    expect(url).toContain('/sandbox/abc1234');
    await page.getByRole('button', { name: 'Copy Link' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(url);
});

test('imports multiline notation locally with the selected next turn', async ({ mount, page }) => {
    let imported: SandboxImportPosition | null = null;
    let requests = 0;
    await page.route('**/api/sandbox-positions/**', route => {
        requests++;
        return route.abort();
    });
    await mount(<SandboxImportModal open onClose={() => {}} onImport={value => { imported = value; }} />);
    await page.getByRole('textbox', { name: 'Position', exact: true }).fill('.x\nxx');
    await page.getByLabel('Next Player').selectOption('player-2');
    await page.getByLabel('Placements Remaining').selectOption('1');
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect.poll(() => imported).toMatchObject({
        id: null,
        gamePosition: {
            cells: [
                { x: 1, y: 0, player: 'player-1' },
                { x: 0, y: 1, player: 'player-1' },
                { x: 1, y: 1, player: 'player-1' },
            ],
            currentTurnPlayer: 'player-2',
            placementsRemaining: 1,
        },
    });
    expect(requests).toBe(0);
});
