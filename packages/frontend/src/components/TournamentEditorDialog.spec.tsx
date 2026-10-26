import type { CreateTournamentRequest, TournamentDetail } from '@ih3t/shared';
import { expect, test } from '@playwright/experimental-ct-react';

import TournamentEditorDialogComponent from './TournamentEditorDialog';

test.use({
    viewport: {
        width: 1280,
        height: 960,
    },
});

const baseRequest: CreateTournamentRequest = {
    name: `Test Tournament`,
    description: ``,
    format: `double-elimination`,
    visibility: `private`,
    scheduledStartAt: Date.now() + 60 * 60 * 1000,
    checkInWindowMinutes: 30,
    maxPlayers: 16,
    timeControl: { mode: `turn`, turnTimeMs: 45_000 },
    seriesSettings: {
        earlyRoundsBestOf: 1,
        finalsBestOf: 3,
        grandFinalBestOf: 5,
        grandFinalResetEnabled: true,
    },
};

test(`submits 256-player elimination tournaments without shrinking the bracket`, async ({ mount, page }) => {
    let submitted: CreateTournamentRequest | null = null;

    await mount(
        <TournamentEditorDialogComponent
            onClose={() => {}}
            formKey="edit"
            title="Edit Tournament"
            description=""
            defaultRequest={{
                ...baseRequest,
                format: `double-elimination`,
                maxPlayers: 256,
            }}
            submitLabel="Save"
            submitting={false}
            onSubmit={(request) => {
                submitted = request;
            }}
        />,
    );

    await page.getByRole(`button`, { name: `Save` }).click();

    await expect.poll(() => submitted?.maxPlayers ?? null).toBe(256);
});

test(`submits 256-player swiss tournaments without clamping to 128`, async ({ mount, page }) => {
    let submitted: CreateTournamentRequest | null = null;

    await mount(
        <TournamentEditorDialogComponent
            onClose={() => {}}
            formKey="edit"
            title="Edit Tournament"
            description=""
            defaultRequest={{
                ...baseRequest,
                format: `swiss`,
                maxPlayers: 256,
            }}
            submitLabel="Save"
            submitting={false}
            onSubmit={(request) => {
                submitted = request;
            }}
        />,
    );

    await page.getByRole(`button`, { name: `Save` }).click();

    await expect.poll(() => submitted?.maxPlayers ?? null).toBe(256);
});

test(`preserves a zero join timeout when editing an existing tournament`, async ({ mount, page }) => {
    let submitted: CreateTournamentRequest | null = null;

    await mount(
        <TournamentEditorDialogComponent
            onClose={() => {}}
            formKey="edit"
            title="Edit Tournament"
            description=""
            defaultRequest={{
                ...baseRequest,
                matchJoinTimeoutMinutes: 0,
            }}
            submitLabel="Save"
            submitting={false}
            onSubmit={(request) => {
                submitted = request;
            }}
        />,
    );

    const joinTimeoutRow = page.getByText(`Join timeout`).locator(`..`);
    await expect(joinTimeoutRow.locator(`input`)).toHaveValue(`0`);

    await page.getByRole(`button`, { name: `Save` }).click();

    await expect.poll(() => submitted?.matchJoinTimeoutMinutes ?? null).toBe(0);
});

test(`preserves unsaved format changes across equivalent prop rerenders`, async ({ mount, page }) => {
    let submitted: CreateTournamentRequest | null = null;

    const component = await mount(
        <TournamentEditorDialogComponent
            onClose={() => {}}
            formKey="edit:tournament-1"
            title="Edit Tournament"
            description=""
            defaultRequest={{ ...baseRequest }}
            submitLabel="Save"
            submitting={false}
            onSubmit={(request) => {
                submitted = request;
            }}
        />,
    );

    await page.getByRole(`button`, { name: `Swiss` }).click();

    await component.update(
        <TournamentEditorDialogComponent
            onClose={() => {}}
            formKey="edit:tournament-1"
            title="Edit Tournament"
            description=""
            defaultRequest={{ ...baseRequest }}
            submitLabel="Save"
            submitting={false}
            onSubmit={(request) => {
                submitted = request;
            }}
        />,
    );

    await page.getByRole(`button`, { name: `Save` }).click();

    await expect.poll(() => submitted?.format ?? null).toBe(`swiss`);
});

test(`resets form state when the form key changes to a different tournament revision`, async ({ mount, page }) => {
    let submitted: CreateTournamentRequest | null = null;

    const component = await mount(
        <TournamentEditorDialogComponent
            onClose={() => {}}
            formKey="edit:tournament-1:1"
            title="Edit Tournament"
            description=""
            defaultRequest={{ ...baseRequest }}
            submitLabel="Save"
            submitting={false}
            onSubmit={(request) => {
                submitted = request;
            }}
        />,
    );

    await page.getByRole(`button`, { name: `Swiss` }).click();

    await component.update(
        <TournamentEditorDialogComponent
            onClose={() => {}}
            formKey="edit:tournament-1:2"
            title="Edit Tournament"
            description=""
            defaultRequest={{
                ...baseRequest,
                format: `single-elimination`,
            }}
            submitLabel="Save"
            submitting={false}
            onSubmit={(request) => {
                submitted = request;
            }}
        />,
    );

    await page.getByRole(`button`, { name: `Save` }).click();

    await expect.poll(() => submitted?.format ?? null).toBe(`single-elimination`);
});

test(`maps join timeout and extension settings from tournament detail into the edit request`, async () => {
    const { buildCreateTournamentRequestFromDetail, createDefaultTournamentRequest } = await import(`./TournamentEditorDialog`);
    const request = buildCreateTournamentRequestFromDetail({
        id: `tournament-1`,
        name: `Test Tournament`,
        description: null,
        kind: `community`,
        format: `double-elimination`,
        visibility: `private`,
        status: `registration-open`,
        isPublished: false,
        scheduledStartAt: Date.now() + 60 * 60 * 1000,
        checkInWindowMinutes: 30,
        checkInOpensAt: Date.now(),
        checkInClosesAt: Date.now() + 30 * 60 * 1000,
        maxPlayers: 16,
        swissRoundCount: null,
        registeredCount: 0,
        checkedInCount: 0,
        participants: [],
        standings: [],
        matches: [],
        activity: [],
        viewer: {
            isSubscribed: false,
            isRegistered: false,
            isWaitlisted: false,
            canRegister: false,
            canJoinWaitlist: false,
            canCheckIn: false,
            canWithdraw: false,
            canManage: false,
            participantId: null,
            participantStatus: null,
            checkInState: null,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        createdByProfileId: `profile-1`,
        createdByDisplayName: `Dev Player 01`,
        organizers: [],
        whitelist: [],
        blacklist: [],
        timeControl: { mode: `turn`, turnTimeMs: 45_000 },
        seriesSettings: {
            earlyRoundsBestOf: 1,
            finalsBestOf: 3,
            grandFinalBestOf: 5,
            grandFinalResetEnabled: true,
        },
        matchJoinTimeoutMinutes: 9,
        matchExtensionMinutes: 4,
        lateRegistrationEnabled: true,
        thirdPlaceMatchEnabled: false,
        roundDelayMinutes: 0,
        waitlistEnabled: false,
        waitlistCheckInMinutes: 5,
        waitlistOpensAt: null,
        waitlistClosesAt: null,
        waitlistedCount: 0,
        extensionRequests: [],
    } as unknown as TournamentDetail);

    expect(request.matchJoinTimeoutMinutes).toBe(9);
    expect(request.matchExtensionMinutes).toBe(4);
    expect(request.lateRegistrationEnabled).toBe(true);

    const defaultRequest = createDefaultTournamentRequest();
    expect(defaultRequest.matchJoinTimeoutMinutes).toBe(5);
    expect(defaultRequest.matchExtensionMinutes).toBe(5);
});


test(`dialog supports cancellation and blocks dismissal while submitting`, async ({ mount, page }) => {
    let closed = false;
    const component = await mount(
        <TournamentEditorDialogComponent
            onClose={() => { closed = true; }}
            formKey="create" title="New Tournament" description=""
            defaultRequest={baseRequest} submitLabel="Create" submitting={true}
            onSubmit={() => {}}
        />,
    );
    await expect(page.getByRole('dialog', { name: 'New Tournament' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await page.keyboard.press('Escape');
    expect(closed).toBe(false);
    await component.update(
        <TournamentEditorDialogComponent
            onClose={() => { closed = true; }}
            formKey="create" title="New Tournament" description=""
            defaultRequest={baseRequest} submitLabel="Create" submitting={false}
            onSubmit={() => {}}
        />,
    );
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => closed).toBe(true);
});

test(`submits the rating seeding and fair tiebreak options`, async ({ mount, page }) => {
    let submitted: CreateTournamentRequest | null = null;

    await mount(
        <TournamentEditorDialogComponent
            onClose={() => {}}
            formKey="create"
            title="Create Tournament"
            description=""
            defaultRequest={{
                ...baseRequest,
                format: `swiss`,
                maxPlayers: 12,
            }}
            submitLabel="Create"
            submitting={false}
            onSubmit={(request) => {
                submitted = request;
            }}
        />,
    );

    await page.getByRole(`button`, { name: `Rating`, exact: true }).click();
    await page.getByRole(`button`, { name: `Fair`, exact: true }).click();
    await page.getByRole(`button`, { name: `Create` }).click();

    await expect.poll(() => submitted?.seedingMode ?? null).toBe(`rating`);
    await expect.poll(() => submitted?.swissTiebreaks ?? null).toBe(`fair`);
});

test(`submits the no-show automation options`, async ({ mount, page }) => {
    let submitted: CreateTournamentRequest | null = null;

    await mount(
        <TournamentEditorDialogComponent
            onClose={() => {}}
            formKey="create"
            title="Create Tournament"
            description=""
            defaultRequest={{
                ...baseRequest,
                matchJoinTimeoutMinutes: 5,
                matchExtensionMinutes: 5,
            }}
            submitLabel="Create"
            submitting={false}
            onSubmit={(request) => {
                submitted = request;
            }}
        />,
    );

    await page.getByRole(`button`, { name: `Automatic`, exact: true }).first().click();
    await page.getByRole(`button`, { name: `Automatic`, exact: true }).last().click();
    await page.getByRole(`combobox`).last().selectOption(`2`);
    await page.getByRole(`button`, { name: `Create` }).click();

    await expect.poll(() => submitted?.noShowHandling ?? null).toBe(`automatic`);
    await expect.poll(() => submitted?.extensionApproval ?? null).toBe(`automatic`);
    await expect.poll(() => submitted?.noShowDropAfter ?? null).toBe(2);
});
