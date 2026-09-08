import { Button } from '@/components/ui/button';
import type { BotEngineCapabilities, SandboxPlayerSlot } from '@ih3t/shared';

import { SandboxBotEngineInfo } from '../../sandbox/botLoader';
import type { SandboxPlayerMode } from '../../sandbox/sandboxBotSettings';
import SandboxBotControls from './SandboxBotControls';
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'

function getBotCapabilitiesLabel(botCapabilities: Readonly<BotEngineCapabilities> | null) {
    if (!botCapabilities) {
        return null;
    }

    if (botCapabilities.suggestTurn && botCapabilities.suggestMove) {
        return i18next.t('supportsFullTurnsAndSinglemoveContinuations', 'Supports full turns and single-move continuations.');
    }

    if (botCapabilities.suggestTurn) {
        return i18next.t('supportsOnlyFullTurns', 'Supports only full turns.');
    }

    if (botCapabilities.suggestMove) {
        return i18next.t('supportsOneMoveAtATimeSuggestions', 'Supports one move at a time suggestions.');
    }

    return i18next.t('doesNotSupportAnyMoveGenerationCapability', 'Does not support any move generation capability.');
}


type SandboxBotPanelProps = {

    selectedFactory: SandboxBotEngineInfo | null,

    botDisplayName: string | null
    botCapabilities: Readonly<BotEngineCapabilities> | null
    botAvailabilityMessage: string | null
    botPlayerModes: Record<SandboxPlayerSlot, SandboxPlayerMode>
    currentTurnPlayerSlot: SandboxPlayerSlot | null
    botTimeoutMs: number
    isBotThinking: boolean
    isCurrentTurnBotControlled: boolean
    botErrorMessage: string | null
    onChangeBotEngine: () => void
    onBotPlayerModeChange: (playerSlot: SandboxPlayerSlot, nextMode: SandboxPlayerMode) => void
    onBotTimeoutMsChange: (timeoutMs: number) => void
};

function SandboxBotPanel({

    selectedFactory,

    botDisplayName,
    botCapabilities,
    botAvailabilityMessage,
    botPlayerModes,

    currentTurnPlayerSlot,
    botTimeoutMs,
    isBotThinking,
    isCurrentTurnBotControlled,
    botErrorMessage,
    onChangeBotEngine,
    onBotPlayerModeChange,
    onBotTimeoutMsChange,
}: Readonly<SandboxBotPanelProps>) {
    const { t } = useTranslation()
    const capabilityLabel = getBotCapabilitiesLabel(botCapabilities);
    return (
        <>
            <div className="mt-4 items-center grid grid-cols-[1fr_auto] gap-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                        {t('engine', 'Engine')}
                    </div>

                    <div className="mt-1 text-sm font-semibold text-white">
                        {selectedFactory?.displayName ?? `None`}
                    </div>
                </div>

                <Button
                    type="button"
                    onClick={onChangeBotEngine}
                    variant="outline" size="sm" className="ml-3"
                >
                    {t('change', 'Change')}
                </Button>

                <div className="col-span-2 text-xs leading-5 text-slate-300">
                    {t('botCapabilityDescription', '{{description}} {{capability}}', {
                        description: selectedFactory?.description(),
                        capability: capabilityLabel,
                    })}
                </div>
            </div>

            <SandboxBotControls
                botDisplayName={botDisplayName}
                botCapabilities={botCapabilities}
                botAvailabilityMessage={botAvailabilityMessage}
                playerModes={botPlayerModes}
                currentTurnPlayerSlot={currentTurnPlayerSlot}
                timeoutMs={botTimeoutMs}
                isBotThinking={isBotThinking}
                isCurrentTurnBotControlled={isCurrentTurnBotControlled}
                botErrorMessage={botErrorMessage}
                onPlayerModeChange={onBotPlayerModeChange}
                onTimeoutMsChange={onBotTimeoutMsChange}
            />
        </>
    );
}

export default SandboxBotPanel;
