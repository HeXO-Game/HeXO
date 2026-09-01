import { DehydratedState, HydrationBoundary, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect } from 'react';
import { RouterProvider } from 'react-router';

import AppErrorBoundary from './components/AppErrorBoundary';
import { trackOpenReplayUser } from './openReplay';
import { useQueryAccount } from './query/accountClient';
import { clearHydrationRenderPassFlag, useRenderMode } from './ssrState';
import { TooltipProvider } from './components/ui/tooltip';
import { useTranslation } from 'react-i18next'

type AppProps = {
    router: Parameters<typeof RouterProvider>[0][`router`]
    queryClient: QueryClient
    dehydratedState?: DehydratedState
};

function OpenReplayUserSync() {
    const renderMode = useRenderMode();
    const accountQuery = useQueryAccount({ enabled: renderMode !== `ssr` });
    const account = accountQuery.data?.user ?? null;

    useEffect(() => {
        if (!account) {
            return;
        }

        trackOpenReplayUser({
            id: account.id,
            username: account.username,
        });
    }, [account]);

    return null;
}

function App({ router, queryClient, dehydratedState }: Readonly<AppProps>) {
    const { t } = useTranslation()
    const renderMode = useRenderMode();

    useEffect(() => clearHydrationRenderPassFlag(), []);

    if (renderMode !== `ssr`) {
        console.log(`Render app root as ${renderMode}`);
    }

    return (
        <AppErrorBoundary>
            <meta charSet="UTF-8" />
            <link rel="icon" type="image/svg+xml" href="/favicon.png" />
            <meta name="viewport" content={t('widthdevicewidthInitialscale10', 'width=device-width, initial-scale=1.0')} />
            <meta name="theme-color" content="#111827" />
            <meta property="og:site_name" content={t('hexoTheInfiniteHexagonalTictactoeGame', 'HeXO: The infinite hexagonal tic-tac-toe game')} />

            <QueryClientProvider client={queryClient}>
                <TooltipProvider>
                    {renderMode === `normal` && <ReactQueryDevtools />}
                    <OpenReplayUserSync />

                    <HydrationBoundary state={dehydratedState}>
                        <RouterProvider router={router} />
                    </HydrationBoundary>
                </TooltipProvider>
            </QueryClientProvider>
        </AppErrorBoundary>
    );
}

export default App;
