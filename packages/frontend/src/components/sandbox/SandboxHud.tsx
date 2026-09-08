import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Menu } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import GameHudShell from '../game-screen/GameHudShell';
import HudInfoBlock from '../game-screen/HudInfoBlock';

type SandboxHudProps = {
    positionName: string | null
    placementPanel: ReactNode
    boardPanel: ReactNode
    positionPanel: ReactNode
    botPanel: ReactNode
};

export default function SandboxHud({
    positionName,
    placementPanel,
    boardPanel,
    positionPanel,
    botPanel
}: SandboxHudProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(true);

    return (
        <GameHudShell
            role="left"
            isOpen={isOpen}
            onOpen={() => setIsOpen(true)}
            onClose={() => setIsOpen(false)}
            openIcon={<Menu />}
            openTitle={t('open', 'Open')}
            closeTitle={t('close', 'Close')}
        >
            <h2 className="mb-4 pr-12 text-lg font-bold">{t('sandboxMode', 'Sandbox Mode')}</h2>
            <div className="text-sm leading-6 text-slate-300">
                {t('localSandboxWithNoClockControlBothPlayersYourselfOrLetABotTakeEitherSide', 'Local sandbox with no clock. Control both players yourself or let a bot take either side.')}
            </div>
            {positionName !== null && (
                <div className="mt-3" role="status">
                    <HudInfoBlock label={t('position', 'Position')}>
                        <div className="wrap-break-word text-sm text-white">{positionName}</div>
                    </HudInfoBlock>
                </div>
            )}

            <Accordion defaultValue={['board']} className={"mt-4"}>
                <AccordionItem value="placement">
                    <AccordionTrigger>
                        {t('placement', 'Placement')}
                    </AccordionTrigger>
                    <AccordionContent>
                        <p className="mb-3 text-xs text-slate-400">{t('chooseHowClicksModifyCells', 'Choose how clicks modify cells')}</p>
                        {placementPanel}
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="bot">
                    <AccordionTrigger>
                        {t('bot', 'Bot')}
                    </AccordionTrigger>
                    <AccordionContent>
                        <p className="mb-3 text-xs text-slate-400">{t('sandboxBotControlsHint', 'Choose an engine and who it plays for.')}</p>
                        {botPanel}
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="board">
                    <AccordionTrigger>
                        {t('board', 'Board')}
                    </AccordionTrigger>
                    <AccordionContent>
                        <p className="mb-3 text-xs text-slate-400">{t('sandboxBoardControlsHint', 'Reset the view or board, or step through moves.')}</p>
                        {boardPanel}
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="position">
                    <AccordionTrigger>{t('position', 'Position')}</AccordionTrigger>
                    <AccordionContent>
                        <p className="mb-3 text-xs text-slate-400">{t('sandboxPositionControlsHint', 'Import, clear, or share a starting position.')}</p>
                        {positionPanel}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </GameHudShell>
    );
}
