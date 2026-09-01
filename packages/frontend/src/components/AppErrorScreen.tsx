import { Button, buttonVariants } from '@/components/ui/button';
type AppErrorScreenProps = {
    badge?: string
    title: string
    message: string
    detail?: string | null
    onRetry?: () => void
    retryLabel?: string
    homeHref?: string
};

function AppErrorScreen({
    badge = `Application Error`,
    title,
    message,
    detail = null,
    onRetry,
    retryLabel = `Try Again`,
    homeHref = `/`,
}: Readonly<AppErrorScreenProps>) {
    const showDetail = import.meta.env.DEV && Boolean(detail);

    return (
        <div className="relative min-h-dvh overflow-hidden bg-[linear-gradient(135deg,_#020617,_#0f172a_45%,_#111827)] text-white">
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(244,63,94,0.16),_transparent_26%),radial-gradient(circle_at_center,_rgba(56,189,248,0.12),_transparent_40%)]"
            />

            <div className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
                <section className="w-full max-w-3xl rounded-[2rem] border border-rose-300/20 bg-slate-950/80 shadow-[0_28px_120px_rgba(2,6,23,0.55)] backdrop-blur-xl">
                    <div className="border-b border-white/10 px-6 py-4 sm:px-8">
                        <p className="text-xs font-semibold uppercase tracking-[0.36em] text-rose-200/80">
                            {badge}
                        </p>
                    </div>

                    <div className="px-6 py-8 sm:px-8 sm:py-10">
                        <h1 className="text-3xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">
                            {title}
                        </h1>

                        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200/85 sm:text-base">
                            {message}
                        </p>

                        <div className="mt-8 flex flex-wrap gap-3">
                            {onRetry && (
                                <Button
                                    type="button"
                                    onClick={onRetry}
                                    variant="secondary" size="lg"
                                >
                                    {retryLabel}
                                </Button>
                            )}

                            <Button
                                type="button"
                                onClick={() => window.location.reload()}
                                variant="outline" size="lg"
                            >
                                Reload App
                            </Button>

                            <a
                                href={homeHref}
                                className={buttonVariants({ variant: `info`, size: `lg` })}
                            >
                                Go To Lobby
                            </a>
                        </div>

                        {showDetail && (
                            <pre className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-left text-xs leading-6 text-rose-100/90">
                                {detail}
                            </pre>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}

export default AppErrorScreen;
