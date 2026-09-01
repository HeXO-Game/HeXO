import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';
import i18next from 'i18next'

function RefreshIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
            <path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16.5 4.5v3.7h-3.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function BackIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
            <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

type PageCorpusProperties = {
    category: ReactNode,
    title: ReactNode,
    description?: ReactNode,
    children?: ReactNode,

    back?: string,
    onBack?: () => void,

    onRefresh?: () => void,
};

const PageCorpus = ({ category, title, description, children, back, onBack, onRefresh }: PageCorpusProperties) => {
    return (
        <div className="flex min-h-0 flex-1 flex-col text-white">
            <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 py-4 sm:py-6">
                <div className="shrink-0 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between px-4 sm:px-6">
                    <div className="min-w-0">
                        <div className="flex items-start justify-between gap-3 lg:block">
                            <div>
                                <p className="text-sm uppercase tracking-[0.32em] text-sky-200/80">
                                    {category}
                                </p>

                                <h1 className="mt-2 text-2xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
                                    {title}
                                </h1>
                            </div>

                            <div className="flex items-center gap-2 lg:hidden">
                                {onBack && (
                                    <Button
                                        onClick={onBack}
                                        aria-label={i18next.t('back', 'Back')}
                                        variant="secondary" size="icon"
                                    >
                                        <BackIcon />
                                    </Button>
                                )}

                                {onRefresh && (
                                    <Button
                                        onClick={onRefresh}
                                        aria-label="Refresh"
                                        variant="outline" size="icon"
                                    >
                                        <RefreshIcon />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {description && (
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:mt-4 sm:text-base sm:leading-7">
                                {description}
                            </p>
                        )}
                    </div>

                    <div className="hidden items-center justify-end gap-3 lg:flex">
                        {onRefresh && (
                            <Button
                                onClick={onRefresh}
                                aria-label={i18next.t('refreshArchive', 'Refresh archive')}
                                variant="outline" size="lg"
                            >
                                {`Refresh\r`}
                            </Button>
                        )}

                        {onBack && (
                            <Button
                                onClick={onBack}
                                variant="secondary" size="lg" className="hidden sm:inline-flex"
                            >
                                {back ?? i18next.t('backToLobby', 'Back To Lobby')}
                            </Button>
                        )}
                    </div>
                </div>

                {children}
            </div>
        </div>
    );
};
export default PageCorpus;
