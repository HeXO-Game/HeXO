import type { AccountPreferences } from '@ih3t/shared';
import { updateAccountPreferences, useQueryAccountPreferences } from '../query/accountClient';
import PageCorpus from './PageCorpus';
import { Switch } from './ui/switch';
import { useMutation } from '@tanstack/react-query';

function PreferenceSwitchCard({
    label,
    description,
    preference,
}: {
    label: string,
    description: string,
    preference: keyof AccountPreferences,
}) {
    const queryPreferences = useQueryAccountPreferences();
    const mutatePreference = useMutation({
        mutationFn: updateAccountPreferences,
    });

    const savedValue = queryPreferences.data?.preferences[preference] === true;
    const optimisticValue = mutatePreference.isPending ? !savedValue : savedValue;

    return (
        <div className="max-w-xl rounded-3xl border border-white/10 bg-slate-950/45 p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
                        {label}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-300">
                        {description}
                    </p>

                    <div className="mt-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        {mutatePreference.isPending ? `Saving...` : optimisticValue ? `Enabled` : `Disabled`}
                    </div>
                </div>

                <Switch
                    checked={optimisticValue}
                    onClick={() => mutatePreference.mutate({ [preference]: !savedValue })}
                    disabled={queryPreferences.isLoading || mutatePreference.isPending}
                />
            </div>
        </div>
    );
}

function AccountPreferencesScreen() {
    return (
        <PageCorpus
            category="Preferences"
            title="Account Preferences"
            description="Manage your personal gameplay, display, and matchmaking settings."
        >
            <div className="grid gap-4 lg:grid-cols-1">
                <PreferenceSwitchCard
                    label="Show Tile Piece Markers"
                    description={`Show visual "X" and "O" markers on hex tiles.`}
                    preference={"tilePieceMarkers"}
                />

                <PreferenceSwitchCard
                    label="Zen Mode In-Game"
                    description="Hide Elo numbers from the live match HUD so you can focus on the board while playing."
                    preference={"zenModeInGame"}
                />

                <PreferenceSwitchCard
                    label="Auto-Place Opening Tile"
                    description={`Automatically place the opening tile at "0,0" when a new match starts and it is your turn.`}
                    preference={"autoPlaceOriginTile"}
                />

                <PreferenceSwitchCard
                    label="Allow Self-Joining Casual Lobbies"
                    description="Allow you to join your own online casual lobby as the second player."
                    preference={"allowSelfJoinCasualGames"}
                />
            </div>
        </PageCorpus>
    );
}

export default AccountPreferencesScreen;
