import { useEffect, useRef, type ReactNode } from 'react';

export default function SandboxOverlay({ open, label, onClose, className, children }: {
    open: boolean
    label: string
    onClose: () => void
    className: string
    children: ReactNode
}) {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const previousFocus = document.activeElement;
        const panel = panelRef.current;
        if (!panel?.contains(document.activeElement)) panel?.focus();
        return () => {
            if (panel?.contains(document.activeElement) && previousFocus instanceof HTMLElement) {
                previousFocus.focus();
            }
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-black/30 p-4 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
            onClick={event => { if (event.target === event.currentTarget) onClose(); }}
            onKeyDown={event => {
                if (event.key === 'Escape') {
                    event.stopPropagation();
                    onClose();
                }
            }}>
            <div ref={panelRef} role="dialog" aria-label={label} tabIndex={-1}
                className={`relative max-h-full overflow-y-auto outline-none animate-in zoom-in-95 duration-200 motion-reduce:animate-none ${className}`}>
                {children}
            </div>
        </div>
    );
}
