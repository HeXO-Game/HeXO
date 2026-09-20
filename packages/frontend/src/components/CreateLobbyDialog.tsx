import { Button } from '@/components/ui/button';
import type { AccountProfile, CreateSessionRequest, GameTimeControl, HouseBotListing, HouseBotsResponse, LobbyFirstPlayer, LobbyVisibility } from '@ih3t/shared';
import { formatThinkSeconds } from '@ih3t/shared';
import type { TFunction } from 'i18next';
import { useEffect, useMemo, useState } from 'react';

import BotBadge from './BotBadge';
import TimeControlSelector from './TimeControlSelector';
import { useTranslation } from 'react-i18next'

/** What the dialog opens on: an open lobby, or the first house bot preselected. */
export type LobbyOpponentChoice = `open` | `bot`;

type CreateLobbyDialogProps = {
    isOpen: boolean
    onClose: () => void
    account: AccountProfile | null
    /** The server's own opponents; null (the flag is off) leaves the dialog exactly as it was. */
    houseBots?: HouseBotsResponse | null
    initialOpponent?: LobbyOpponentChoice
    onCreateLobby: (request: CreateSessionRequest) => void
};

type LocalizedOption<T> = {
    value: T
    title: (t: TFunction) => string
    description: (t: TFunction) => string
};

const visibilityOptions: LocalizedOption<LobbyVisibility>[] = [
    {
        value: `public`,
        title: (t) => t('publicLobby', 'Public Lobby'),
        description: (t) => t('listedInTheLiveBrowser', 'Listed in the live browser.'),
    },
    {
        value: `private`,
        title: (t) => t('privateLobby', 'Private Lobby'),
        description: (t) => t('hiddenUntilSharedDirectly', 'Hidden until shared directly.'),
    },
];

const firstPlayerOptions: LocalizedOption<LobbyFirstPlayer>[] = [
    {
        value: `random`,
        title: (t) => t('random', 'Random'),
        description: (t) => t('randomlyChooseWhoOpensTheGame', 'Randomly choose who opens the game.'),
    },
    {
        value: `host`,
        title: (t) => t('hostStarts', 'Host Starts'),
        description: (t) => t('thePlayerWhoCreatesTheLobbyTakesTheFirstTurn', 'The player who creates the lobby takes the first turn.'),
    },
    {
        value: `guest`,
        title: (t) => t('guestStarts', 'Guest Starts'),
        description: (t) => t('theJoiningPlayerTakesTheFirstTurn', 'The joining player takes the first turn.'),
    },
];

const TURN_TIME_STEP_SECONDS = [
    5, 10, 15, 20, 30, 45, 60, 90, 120,
] as const;
const TURN_TIME_DEFAULT = 45;

const MATCH_TIME_STEP_MINUTES = [
    1, 2, 3, 4, 5, 10, 15, 20, 30, 45, 60,
] as const;
const MATCH_TIME_DEFAULT = 5;

const INCREMENT_STEP_SECONDS = [
    0, 1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300,
] as const;
const INCREMENT_DEFAULT = 5;

/* The custom-strength slider's ladder, cut to what the chosen bot's engine allows. */
const THINK_TIME_LADDER_MS = [
    10, 20, 50, 100, 200, 300, 500, 750, 1_000, 1_500, 2_000, 3_000, 5_000,
] as const;

/* Preset ids the server may send; anything else is shown by its think time alone. */
const strengthPresetLabels: Record<string, (t: TFunction) => string> = {
    beginner: (t) => t('beginner', 'Beginner'),
    easy: (t) => t('easy', 'Easy'),
    medium: (t) => t('medium', 'Medium'),
    hard: (t) => t('hard', 'Hard'),
    expert: (t) => t('expert', 'Expert'),
};

function thinkTimeSteps(bot: HouseBotListing): number[] {
    const steps = THINK_TIME_LADDER_MS.filter((step) => step >= bot.thinkMs.min && step <= bot.thinkMs.max);
    return steps.length > 0 ? steps : [bot.thinkMs.default];
}

function nearestStepIndex(steps: readonly number[], thinkMs: number): number {
    let best = 0;
    for (let index = 1; index < steps.length; index += 1) {
        if (Math.abs(steps[index] - thinkMs) < Math.abs(steps[best] - thinkMs)) {
            best = index;
        }
    }

    return best;
}

function SelectableOptions({ onClick, selected, title, description, disabled = false }: Readonly<{ onClick: () => void, selected: boolean, title: string, description: string, disabled?: boolean }>) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`flex flex-col items-start rounded-[0.9rem] border p-3 text-left transition ${selected
                ? `border-sky-300/35 bg-sky-300/10 shadow-[0_8px_18px_rgba(14,165,233,0.1)]`
                : disabled
                    ? `cursor-not-allowed border-white/8 bg-white/4 opacity-60`
                    : `border-white/10 bg-white/6 hover:border-white/20 hover:bg-white/10`
                }`}
        >
            <div className="flex flex-row items-center text-sm font-bold text-white">
                <span className={`mr-2 inline-block h-3.5 w-3.5 align-sub rounded-full border ${selected ? `border-sky-200 bg-sky-300` : `border-white/20 bg-slate-900/40`}`} />
                {title}
            </div>

            <div className="mt-1 text-[11px] leading-4.5 text-slate-300">
                {description}
            </div>
        </button>
    );
}

function CreateLobbyDialog({
    isOpen,
    onClose,
    account,
    houseBots = null,
    initialOpponent = `open`,
    onCreateLobby,
}: Readonly<CreateLobbyDialogProps>) {
    const { t } = useTranslation()
    const canCreateRatedLobby = Boolean(account);
    const [visibility, setVisibility] = useState<LobbyVisibility>(`public`);
    const [timeControlMode, setTimeControlMode] = useState<GameTimeControl[`mode`]>(`match`);
    const [rated, setRated] = useState(canCreateRatedLobby);
    const [firstPlayer, setFirstPlayer] = useState<LobbyFirstPlayer>(`random`);
    const [opponentBotId, setOpponentBotId] = useState<string | null>(null);
    const [thinkMs, setThinkMs] = useState(0);
    const [customStrength, setCustomStrength] = useState(false);
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
    const [turnTimeStepIndex, setTurnTimeStepIndex] = useState(TURN_TIME_STEP_SECONDS.indexOf(TURN_TIME_DEFAULT));
    const [matchTimeStepIndex, setMatchTimeStepIndex] = useState(MATCH_TIME_STEP_MINUTES.indexOf(MATCH_TIME_DEFAULT));
    const [incrementStepIndex, setIncrementStepIndex] = useState(INCREMENT_STEP_SECONDS.indexOf(INCREMENT_DEFAULT));

    useEffect(() => {
        setRated(canCreateRatedLobby);
    }, [canCreateRatedLobby]);

    const canPickBot = houseBots !== null && houseBots.available && houseBots.bots.length > 0;
    const selectBot = (bot: HouseBotListing | null) => {
        setOpponentBotId(bot?.profileId ?? null);
        setThinkMs(bot?.thinkMs.default ?? 0);
        setCustomStrength(false);
    };

    useEffect(() => {
        if (isOpen) {
            setShowAdvancedOptions(false);
            selectBot(initialOpponent === `bot` && canPickBot ? houseBots.bots[0] : null);
        }
        /* Opening resets the opponent; what the list holds while open is not a reset. */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialOpponent]);

    const selectedBot = opponentBotId
        ? houseBots?.bots.find((bot) => bot.profileId === opponentBotId) ?? null
        : null;
    const strengthSteps = selectedBot ? thinkTimeSteps(selectedBot) : [];
    const selectedPreset = selectedBot && !customStrength
        ? selectedBot.presets.find((preset) => preset.thinkMs === thinkMs) ?? null
        : null;
    const presetLabel = (id: string) => strengthPresetLabels[id]?.(t) ?? null;

    const turnTimeSeconds = TURN_TIME_STEP_SECONDS[turnTimeStepIndex];
    const matchTimeMinutes = MATCH_TIME_STEP_MINUTES[matchTimeStepIndex];
    const incrementSeconds = INCREMENT_STEP_SECONDS[incrementStepIndex];

    const selectedTimeControl = useMemo<GameTimeControl>(() => {
        if (timeControlMode === `turn`) {
            return {
                mode: `turn`,
                turnTimeMs: turnTimeSeconds * 1000,
            };
        }

        if (timeControlMode === `match`) {
            return {
                mode: `match`,
                mainTimeMs: matchTimeMinutes * 60 * 1000,
                incrementMs: incrementSeconds * 1000,
            };
        }

        return {
            mode: `unlimited`,
        };
    }, [
        incrementSeconds, matchTimeMinutes, timeControlMode, turnTimeSeconds,
    ]);

    const selectedFirstPlayer = firstPlayerOptions.find((option) => option.value === firstPlayer) ?? firstPlayerOptions[0];
    /* A bot seat is never rated and the server picks who starts; the dialog stops
     * offering choices it would not honour. */
    const isRated = selectedBot ? false : rated;
    const firstPlayerTitle = selectedBot ? t('random', 'Random') : selectedFirstPlayer.title(t);

    if (!isOpen) {
        return null;
    }

    const handleCreate = () => {
        const request: CreateSessionRequest = {
            lobbyOptions: {
                visibility,
                timeControl: selectedTimeControl,
                rated: isRated,
                firstPlayer: selectedBot ? `random` : firstPlayer,
            },
        };
        if (selectedBot) {
            request.opponent = { kind: `house-bot`, profileId: selectedBot.profileId, thinkMs };
        }

        onCreateLobby(request);
    };

    const badges = [
        isRated ? t('rated', 'Rated') : t('casual', 'Casual'),
        visibility === `private` ? t('private', 'Private') : t('public', 'Public'),
        firstPlayerTitle
    ]

    const opponentSection = houseBots && (
        <section className="p-0" data-testid="opponent-section">
            <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    {t('opponent', 'Opponent')}
                </div>

                <div className="flex items-center gap-2 rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                    {selectedBot ? (
                        <>
                            {selectedBot.displayName} {formatThinkSeconds(thinkMs)}
                            <BotBadge />
                        </>
                    ) : t('openLobby', 'Open lobby')}
                </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
                <SelectableOptions
                    onClick={() => selectBot(null)}
                    selected={!selectedBot}
                    title={t('openLobby', 'Open lobby')}
                    description={t('anyoneCanTakeTheOtherSeat', 'Anyone can take the other seat.')}
                />

                {houseBots.bots.map((bot) => (
                    <SelectableOptions
                        key={bot.profileId}
                        onClick={() => selectBot(bot)}
                        selected={selectedBot?.profileId === bot.profileId}
                        disabled={!houseBots.available}
                        title={bot.displayName}
                        description={houseBots.available
                            ? t('theServerPlaysYouAtTheStrengthYouPick', 'The server plays you at the strength you pick.')
                            : t('busyInEveryGameItCanPlayRightNow', 'Busy in every game it can play right now. Try again in a moment.')}
                    />
                ))}
            </div>

            {selectedBot && (
                <div className="mt-2.5 rounded-[0.9rem] border border-white/8 bg-white/4 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                            {t('strength', 'Strength')}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                            {selectedPreset
                                ? presetLabel(selectedPreset.id) && <span>{presetLabel(selectedPreset.id)}</span>
                                : <span>{t('custom', 'Custom')}</span>}
                            <span>{formatThinkSeconds(thinkMs)}</span>
                        </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t('strength', 'Strength')}>
                        {selectedBot.presets.map((preset) => {
                            const active = selectedPreset?.id === preset.id;
                            const label = presetLabel(preset.id);

                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => {
                                        setCustomStrength(false);
                                        setThinkMs(preset.thinkMs);
                                    }}
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${active
                                        ? `border-sky-300/35 bg-sky-300/15 text-white`
                                        : `border-white/10 bg-white/6 text-slate-200 hover:border-white/20 hover:bg-white/10`}`}
                                >
                                    {label ? `${label} · ` : ``}{formatThinkSeconds(preset.thinkMs)}
                                </button>
                            );
                        })}

                        {strengthSteps.length > 1 && (
                        <button
                            type="button"
                            aria-pressed={customStrength}
                            onClick={() => setCustomStrength(true)}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${customStrength
                                ? `border-sky-300/35 bg-sky-300/15 text-white`
                                : `border-white/10 bg-white/6 text-slate-200 hover:border-white/20 hover:bg-white/10`}`}
                        >
                            {t('custom', 'Custom')}
                        </button>
                        )}
                    </div>

                    {customStrength && strengthSteps.length > 1 && (
                        <div className="mt-2.5 space-y-1.5">
                            <input
                                type="range"
                                min={0}
                                max={strengthSteps.length - 1}
                                step={1}
                                value={nearestStepIndex(strengthSteps, thinkMs)}
                                aria-label={t('thinkTimePerTurn', 'Think time per turn')}
                                onChange={(event) => setThinkMs(strengthSteps[Number(event.target.value)])}
                                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-sky-300"
                            />

                            <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                <span>{formatThinkSeconds(strengthSteps[0])}</span>
                                <span>{formatThinkSeconds(strengthSteps[strengthSteps.length - 1])}</span>
                            </div>
                        </div>
                    )}

                    <div className="mt-2 text-[11px] leading-4.5 text-slate-300">
                        {t('theLongerItThinksTheDeeperItSearches', 'The longer it thinks per turn, the deeper it searches. Games against it are unrated.')}
                    </div>
                </div>
            )}
        </section>
    );

    return (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/70 px-4 py-6 backdrop-blur-md flex flex-col">
            <div
                className="absolute inset-0"
                onClick={onClose}
            />

            <div className="relative my-auto z-10 flex self-center items-center justify-center">
                <section className="relative my-auto w-full max-w-2xl overflow-hidden rounded-[1.25rem] border border-white/10 bg-[linear-gradient(155deg,rgba(15,23,42,0.97),rgba(17,24,39,0.95)_55%,rgba(30,41,59,0.92))] p-3.5 text-white shadow-[0_24px_80px_rgba(2,6,23,0.55)] sm:p-4">
                    <div className="absolute -right-10 -top-14 h-20 w-20 rounded-full bg-sky-400/16 blur-3xl" />
                    <div className="absolute -left-8 bottom-0 h-16 w-16 rounded-full bg-amber-300/12 blur-3xl" />

                    <div className="relative">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
                                    {t('createLobby', 'Create Lobby')}
                                </div>

                                <h2 className="mt-1 text-lg font-black uppercase tracking-[0.05em] text-white sm:text-xl">
                                    {t('lobbySetup', 'Lobby Setup')}
                                </h2>
                            </div>

                            <Button
                                type="button"
                                aria-expanded={showAdvancedOptions}
                                onClick={() => setShowAdvancedOptions((value) => !value)}
                                variant="info" size="sm"
                            >
                                {showAdvancedOptions ? t('simpleSettings', 'Simple Settings') : t('advancedSettings', 'Advanced Settings')}
                            </Button>
                        </div>

                        <div className="mt-3 flex flex-col gap-4 sm:gap-6">
                            {!showAdvancedOptions && (
                                <section className="p-0">
                                    <div className="rounded-[0.9rem] flex flex-row pb-2.5 text-xs leading-5 text-slate-300 gap-2">
                                        {badges.map(name => (
                                            <div key={name} className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
                                                {name}
                                            </div>
                                        ))}
                                    </div>

                                    {opponentSection && (
                                        <div className="mb-4 sm:mb-6">
                                            {opponentSection}
                                        </div>
                                    )}

                                    <TimeControlSelector
                                        mode={timeControlMode}
                                        selectedTimeControl={selectedTimeControl}
                                        turnTimeSeconds={turnTimeSeconds}
                                        matchTimeMinutes={matchTimeMinutes}
                                        incrementSeconds={incrementSeconds}
                                        turnTimeStepCount={TURN_TIME_STEP_SECONDS.length}
                                        matchTimeStepCount={MATCH_TIME_STEP_MINUTES.length}
                                        incrementStepCount={INCREMENT_STEP_SECONDS.length}
                                        turnTimeStepIndex={turnTimeStepIndex}
                                        matchTimeStepIndex={matchTimeStepIndex}
                                        incrementStepIndex={incrementStepIndex}
                                        onModeChange={setTimeControlMode}
                                        onTurnTimeStepIndexChange={setTurnTimeStepIndex}
                                        onMatchTimeStepIndexChange={setMatchTimeStepIndex}
                                        onIncrementStepIndexChange={setIncrementStepIndex}
                                    />
                                </section>
                            )}

                            {showAdvancedOptions && (
                                <>
                                    {opponentSection}

                                    {!selectedBot && (
                                    <section className="p-0">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                                    {t('mode', 'Mode')}
                                                </div>
                                            </div>

                                            <div className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${rated ? `bg-amber-300/15 text-amber-100` : `bg-white/8 text-slate-100`}`}>
                                                {rated ? t('rated', 'Rated') : t('casual', 'Casual')}
                                            </div>
                                        </div>

                                        <div className="mt-2.5 grid grid-cols-2 gap-2">
                                            <SelectableOptions
                                                onClick={() => setRated(false)}
                                                selected={!rated}
                                                title={t('casual', 'Casual')}
                                                description={t('casualUnratedGame', 'Casual unrated game')}
                                            />

                                            <SelectableOptions
                                                onClick={() => {
                                                    if (canCreateRatedLobby) {
                                                        setRated(true);
                                                    }
                                                }}
                                                selected={rated}
                                                disabled={!canCreateRatedLobby}
                                                title={t('rated', 'Rated')}
                                                description={t('ratedGameWithElo', 'Rated game with ELO')}
                                            />
                                        </div>

                                        {!canCreateRatedLobby && (
                                            <div className="mt-2.5 rounded-[0.9rem] border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-xs leading-5 text-amber-50/85">
                                                {t('ratedLobbiesAreForAuthenticatedPlayersOnly', 'Rated lobbies are for authenticated players only.')}
                                            </div>
                                        )}
                                    </section>
                                    )}

                                    <section className="p-0">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                                    {t('visibility', 'Visibility')}
                                                </div>
                                            </div>

                                            <div className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                                                {visibility === `private` ? t('private', 'Private') : t('public', 'Public')}
                                            </div>
                                        </div>

                                        <div className="mt-2.5 grid grid-cols-2 gap-2">
                                            {visibilityOptions.map((option) => {
                                                const selected = visibility === option.value;

                                                return (
                                                    <SelectableOptions
                                                        key={option.value}

                                                        onClick={() => setVisibility(option.value)}
                                                        selected={selected}

                                                        title={option.title(t)}
                                                        description={option.description(t)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </section>

                                    {!selectedBot && (
                                    <section className="p-0">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                                    {t('firstPlayer', 'First Player')}
                                                </div>
                                            </div>

                                            <div className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                                                {firstPlayerTitle}
                                            </div>
                                        </div>

                                        <div className="mt-2.5 grid gap-2 md:grid-cols-3">
                                            {firstPlayerOptions.map((option) => {
                                                const selected = firstPlayer === option.value;

                                                return (
                                                    <SelectableOptions
                                                        key={option.value}
                                                        onClick={() => setFirstPlayer(option.value)}
                                                        selected={selected}
                                                        title={option.title(t)}
                                                        description={option.description(t)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </section>
                                    )}


                                    <section>
                                        <TimeControlSelector
                                            mode={timeControlMode}
                                            selectedTimeControl={selectedTimeControl}
                                            turnTimeSeconds={turnTimeSeconds}
                                            matchTimeMinutes={matchTimeMinutes}
                                            incrementSeconds={incrementSeconds}
                                            turnTimeStepCount={TURN_TIME_STEP_SECONDS.length}
                                            matchTimeStepCount={MATCH_TIME_STEP_MINUTES.length}
                                            incrementStepCount={INCREMENT_STEP_SECONDS.length}
                                            turnTimeStepIndex={turnTimeStepIndex}
                                            matchTimeStepIndex={matchTimeStepIndex}
                                            incrementStepIndex={incrementStepIndex}
                                            onModeChange={setTimeControlMode}
                                            onTurnTimeStepIndexChange={setTurnTimeStepIndex}
                                            onMatchTimeStepIndexChange={setMatchTimeStepIndex}
                                            onIncrementStepIndexChange={setIncrementStepIndex}
                                        />
                                    </section>
                                </>
                            )}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-3">
                            <Button
                                onClick={onClose}
                                variant="outline" size="default"
                            >
                                {t('cancel', 'Cancel')}
                            </Button>

                            <Button
                                onClick={handleCreate}
                                variant="secondary" size="default"
                            >
                                {t('createLobby', 'Create Lobby')}
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default CreateLobbyDialog;
