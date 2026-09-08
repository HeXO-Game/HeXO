import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

type SandboxPositionPanelProps = {
    hasPosition: boolean
    canSharePosition: boolean

    onImportPosition: () => void
    onResetPosition: () => void
    onSharePosition: () => void
};

export default function SandboxPositionPanel({
    hasPosition,
    canSharePosition,

    onImportPosition,
    onResetPosition,
    onSharePosition,
}: SandboxPositionPanelProps) {
    const { t } = useTranslation();
    return (
        <div className="grid grid-cols-2 gap-2">
            <Button variant="muted" size="sm" onClick={onImportPosition}>
                {t('import', 'Import')}
            </Button>
            <Button variant="muted" size="sm" onClick={onSharePosition} disabled={!canSharePosition}>
                {t('export', 'Export')}
            </Button>
            <Button variant="muted" size="sm" onClick={onResetPosition} disabled={!hasPosition}>
                {t('reset', 'Reset')}
            </Button>
        </div>
    );
}
