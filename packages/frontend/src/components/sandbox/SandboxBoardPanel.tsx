import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

type SandboxBoardPanelProps = {
    onResetBoard: () => void
    onUndo: () => void
    onRedo: () => void
    onResetView: () => void
    canUndo: boolean
    canRedo: boolean
};

export default function SandboxBoardPanel({ onResetBoard, onUndo, onRedo, onResetView, canUndo, canRedo }: SandboxBoardPanelProps) {
    const { t } = useTranslation();
    return (
        <div className="grid grid-cols-2 gap-2">
            <Button variant="muted" size="sm" onClick={onResetView}>{t('resetView', 'Reset View')}</Button>
            <Button variant="muted" size="sm" onClick={onResetBoard}>{t('resetBoard', 'Reset Board')}</Button>
            <Button variant="muted" size="sm" onClick={onUndo} disabled={!canUndo}>{t('undo', 'Undo')}</Button>
            <Button variant="muted" size="sm" onClick={onRedo} disabled={!canRedo}>{t('redo', 'Redo')}</Button>
        </div>
    );
}
