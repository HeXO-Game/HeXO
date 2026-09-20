import type { AccountProfile, CreateSessionRequest, HouseBotsResponse } from '@ih3t/shared'
import { expect, test } from '@playwright/experimental-ct-react'
import CreateLobbyDialog from './CreateLobbyDialog'

test.use({
  viewport: {
    width: 1280,
    height: 960,
  },
})

const authenticatedAccount: AccountProfile = {
  id: 'account-1',
  username: 'Player One',
  email: 'player@example.com',
  image: null,
  role: 'user',
  kind: 'human',
  permissions: [],
  registeredAt: 1_700_000_000_000,
  lastActiveAt: 1_700_000_000_000,
}

test('submits casual match defaults for guests', async ({ mount }) => {
  let createRequest: CreateSessionRequest | null = null
  let closeCount = 0

  const component = await mount(
    <CreateLobbyDialog
      isOpen
      onClose={() => {
        closeCount += 1
      }}
      account={null}
      onCreateLobby={(request) => {
        createRequest = request
      }}
    />
  )

  await expect(component.getByRole('button', { name: /^Customize Match$/i })).toBeVisible()
  await expect(component.getByText('Rated lobbies are for authenticated players only.')).toHaveCount(0)

  await component.getByRole('button', { name: /^Create Lobby$/i }).click()

  await expect.poll(() => createRequest).toEqual({
    lobbyOptions: {
      visibility: 'public',
      timeControl: {
        mode: 'match',
        mainTimeMs: 5 * 60 * 1000,
        incrementMs: 5 * 1000,
      },
      rated: false,
      firstPlayer: 'random',
    },
  })

  await component.getByRole('button', { name: /^Cancel$/i }).click()
  await expect.poll(() => closeCount).toBe(1)
})

test('submits a rated private turn-based lobby for authenticated players', async ({ mount }) => {
  let createRequest: CreateSessionRequest | null = null

  const component = await mount(
    <CreateLobbyDialog
      isOpen
      onClose={() => { }}
      account={authenticatedAccount}
      onCreateLobby={(request) => {
        createRequest = request
      }}
    />
  )

  await expect(component.getByText('Rated lobbies are for authenticated players only.')).toHaveCount(0)
  await component.getByRole('button', { name: /^Customize Match$/i }).click()
  await expect(component.getByRole('button', { name: /with ELO/i })).toBeEnabled()

  await component.getByRole('button', { name: /Private Lobby/i }).click()
  await component.getByRole('button', { name: /Guest Starts/i }).click()
  await component.getByRole('button', { name: /Turn Based/i }).click()

  await expect(component.getByText('turn time')).toBeVisible()
  await component.locator('input[type="range"]').fill("2");

  await component.getByRole('button', { name: /^Create Lobby$/i }).click()

  expect(createRequest).toEqual({
    lobbyOptions: {
      visibility: 'private',
      timeControl: {
        mode: 'turn',
        turnTimeMs: 15 * 1000,
      },
      rated: true,
      firstPlayer: 'guest',
    },
  })
})

const houseBots: HouseBotsResponse = {
  bots: [{
    profileId: 'house-seal',
    displayName: 'SealBot',
    engine: 'seal',
    thinkMs: { min: 10, max: 5_000, default: 300 },
    presets: [
      { id: 'beginner', thinkMs: 10 },
      { id: 'easy', thinkMs: 100 },
      { id: 'medium', thinkMs: 300 },
      { id: 'hard', thinkMs: 500 },
      { id: 'expert', thinkMs: 1_000 },
    ],
  }],
  available: true,
}

/* The locale files do not load in the component-test harness on every machine, so
 * the selectors below work with the inline fallbacks too. */
test('without house bots the opponent section does not exist', async ({ mount }) => {
  const component = await mount(
    <CreateLobbyDialog isOpen onClose={() => { }} account={authenticatedAccount} onCreateLobby={() => { }} />
  )

  await expect(component.getByTestId('opponent-section')).toHaveCount(0)
  await expect(component.getByRole('button', { name: /SealBot/ })).toHaveCount(0)
})

test('picking the house bot submits its seat with the chosen preset, unrated and random', async ({ mount }) => {
  let createRequest: CreateSessionRequest | null = null

  const component = await mount(
    <CreateLobbyDialog
      isOpen
      onClose={() => { }}
      account={authenticatedAccount}
      houseBots={houseBots}
      onCreateLobby={(request) => {
        createRequest = request
      }}
    />
  )

  await expect(component.getByTestId('opponent-section')).toBeVisible()
  await component.getByRole('button', { name: /^SealBot/ }).click()
  await expect(component.getByRole('button', { name: /Medium/ })).toHaveAttribute('aria-pressed', 'true')
  await component.getByRole('button', { name: /Hard/ }).click()
  await expect(component.getByRole('button', { name: /Hard/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(component.getByText('SealBot 0.5s')).toBeVisible()

  /* The rated and first-player pickers are gone: a bot seat is never rated. */
  await component.getByRole('button', { name: /Customize Match|Advanced Settings/i }).click()
  await expect(component.getByText(/Rated game with ELO/i)).toHaveCount(0)
  await expect(component.getByText(/Host Starts/i)).toHaveCount(0)
  await expect(component.getByText(/Private Lobby/i)).toBeVisible()

  await component.getByRole('button', { name: /^Create Lobby$/i }).click()

  await expect.poll(() => createRequest).toEqual({
    lobbyOptions: {
      visibility: 'public',
      timeControl: {
        mode: 'match',
        mainTimeMs: 5 * 60 * 1000,
        incrementMs: 5 * 1000,
      },
      rated: false,
      firstPlayer: 'random',
    },
    opponent: { kind: 'house-bot', profileId: 'house-seal', thinkMs: 500 },
  })
})

test('a custom strength comes off the slider within the engine range', async ({ mount }) => {
  let createRequest: CreateSessionRequest | null = null

  const component = await mount(
    <CreateLobbyDialog
      isOpen
      initialOpponent="bot"
      onClose={() => { }}
      account={null}
      houseBots={houseBots}
      onCreateLobby={(request) => {
        createRequest = request
      }}
    />
  )

  await expect(component.getByText('SealBot 0.3s')).toBeVisible()
  await component.getByRole('button', { name: /^Custom$/ }).click()
  await expect(component.getByRole('button', { name: /^Custom$/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(component.getByRole('button', { name: /Medium/ })).toHaveAttribute('aria-pressed', 'false')
  const slider = component.getByRole('slider', { name: /Think time/i })
  await expect(slider).toBeVisible()
  await slider.fill('12')
  await expect(component.getByText('SealBot 5s')).toBeVisible()

  await component.getByRole('button', { name: /^Create Lobby$/i }).click()
  await expect.poll(() => createRequest?.opponent).toEqual({ kind: 'house-bot', profileId: 'house-seal', thinkMs: 5_000 })
})

test('at capacity the bot is shown but not offered, and open lobbies still work', async ({ mount }) => {
  let createRequest: CreateSessionRequest | null = null

  const component = await mount(
    <CreateLobbyDialog
      isOpen
      initialOpponent="bot"
      onClose={() => { }}
      account={null}
      houseBots={{ ...houseBots, available: false }}
      onCreateLobby={(request) => {
        createRequest = request
      }}
    />
  )

  await expect(component.getByRole('button', { name: /^SealBot/ })).toBeDisabled()
  await expect(component.getByText(/Try again in a moment/i)).toBeVisible()
  await expect(component.getByText('SealBot 0.3s')).toHaveCount(0)

  await component.getByRole('button', { name: /^Create Lobby$/i }).click()
  await expect.poll(() => createRequest).toEqual({
    lobbyOptions: {
      visibility: 'public',
      timeControl: {
        mode: 'match',
        mainTimeMs: 5 * 60 * 1000,
        incrementMs: 5 * 1000,
      },
      rated: false,
      firstPlayer: 'random',
    },
  })
})

test('matches the authenticated lobby dialog screenshot', async ({ mount }) => {
  const component = await mount(
    <CreateLobbyDialog
      isOpen
      onClose={() => { }}
      account={authenticatedAccount}
      onCreateLobby={() => { }}
    />
  )

  await expect(component).toHaveScreenshot('create-lobby-dialog-authenticated.png', {
    animations: 'disabled',
    scale: 'css',
  })
})
