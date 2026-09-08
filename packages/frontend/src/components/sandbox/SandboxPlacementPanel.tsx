import { useTranslation } from 'react-i18next';
import type { SandboxPlacementMode } from '../../sandbox/sandboxPlacement';

type SandboxPlacementPanelProps = {
    placementMode: SandboxPlacementMode
    onPlacementModeChange: (mode: SandboxPlacementMode) => void
};

export default function SandboxPlacementPanel({ placementMode, onPlacementModeChange }: SandboxPlacementPanelProps) {
    const { t } = useTranslation();
    const modes = [
        ['turn', t('turn', 'Turn'), t('followTurns', 'Follow turns')],
        ['toggle', t('toggle', 'Toggle'), t('cyclePieces', 'Cycle pieces')],
        ['player-1', 'X', t('placeX', 'Place X')],
        ['player-2', 'O', t('placeO', 'Place O')],
    ] as const;

    return (
        <div className="grid grid-cols-2 gap-2">
            {modes.map(([mode, label, description]) => (
                <button
                    key={mode}
                    type="button"
                    aria-label={label}
                    aria-pressed={placementMode === mode}
                    onClick={() => onPlacementModeChange(mode)}
                    title={description}
                    className={`group flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-slate-950/35 px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${placementMode === mode
                        ? mode === 'player-1' ? 'border-amber-400 bg-amber-400/5 text-amber-400' : 'border-sky-400 bg-sky-400/5 text-sky-400'
                        : 'border-slate-600/50 text-slate-300 hover:border-slate-400/60 hover:bg-slate-700/40'}`}
                >
                    <span className="text-sm font-semibold">
                        {label}
                    </span>
                    <span aria-hidden="true" className="flex shrink-0 gap-1.5 opacity-60 group-aria-pressed:opacity-100">
                        {(mode === 'toggle' || mode === 'player-1') && <span className="size-2.5 rounded-full bg-amber-400" />}
                        {mode !== 'player-1' && <span className="size-2.5 rounded-full bg-sky-400" />}
                    </span>
                </button>
            ))}
        </div>
    );
}
