import type { FinishedGamesPage } from '@ih3t/shared';

import type { FinishedGamesArchiveView, FinishedGamesRatedFilter } from '../query/queryDefinitions';
import FinishedGameCard from './FinishedGameCard';
import PageCorpus from './PageCorpus';
import PageNavigation from './PageNavigation';
import RatedFilterTabs from './RatedFilterTabs';
import { useTranslation } from 'react-i18next'

type FinishedGamesScreenProps = {
    archive: FinishedGamesPage | null
    archiveView: FinishedGamesArchiveView
    currentProfileId: string | null
    requiresSignIn: boolean
    showSignInHint: boolean
    isLoading: boolean
    errorMessage: string | null
    onChangePage: (page: number) => void
    onRefresh: () => void
    ratedFilter: FinishedGamesRatedFilter
    onChangeRatedFilter: (ratedFilter: FinishedGamesRatedFilter) => void
};

function FinishedGamesScreen({
    archive,
    archiveView,
    currentProfileId,
    requiresSignIn,
    showSignInHint,
    isLoading,
    errorMessage,
    onChangePage,
    ratedFilter,
    onChangeRatedFilter,
}: Readonly<FinishedGamesScreenProps>) {
    const { t } = useTranslation()
    const isOwnArchive = archiveView === `mine`;
    const games = archive?.games ?? [];
    const pagination = archive?.pagination;
    const currentPage = pagination?.page ?? 1;
    const totalPages = pagination?.totalPages ?? 1;
    const totalGames = pagination?.totalGames ?? 0;
    const totalMoves = pagination?.totalMoves ?? 0;
    const pageStart = games.length === 0 ? 0 : (currentPage - 1) * (pagination?.pageSize ?? games.length) + 1;
    const pageEnd = games.length === 0 ? 0 : pageStart + games.length - 1;

    return (
        <PageCorpus
            category={t('finishedGames', 'Finished Games')}
            title={isOwnArchive ? t('myMatchHistory', 'My Match History') : `Match Archive`}
            description={isOwnArchive
                ? t('reviewTheFinishedMatchesYouPlayedWhileSignedInAndOpenAnyReplayMoveByMove', 'Review the finished matches you played while signed in and open any replay move by move.')
                : t('browseCompletedMatchesAndOpenAnyGameToStepThroughEveryMoveOnTheBoard', 'Browse completed matches and open any game to step through every move on the board.')}
        >
            <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-[auto_auto_1fr] px-4 sm:px-6">
                <div className="inline-flex items-center rounded-md border border-white/10 bg-white/6 px-3 py-1.5 text-xs text-slate-200 sm:px-4 sm:py-2 sm:text-sm">
                    <span className="uppercase tracking-[0.18em] text-slate-400 sm:tracking-[0.22em]">
                        {t('games', 'Games')}
                    </span>

                    <span className="ml-2 text-base font-black text-white sm:ml-3 sm:text-lg">
                        {totalGames}
                    </span>
                </div>

                <div className="inline-flex items-center rounded-md border border-white/10 bg-white/6 px-3 py-1.5 text-xs text-slate-200 sm:px-4 sm:py-2 sm:text-sm">
                    <span className="uppercase tracking-[0.18em] text-slate-400 sm:tracking-[0.22em]">
                        {t('moves2', 'Moves')}
                    </span>

                    <span className="ml-2 text-base font-black text-white sm:ml-3 sm:text-lg">
                        {totalMoves}
                    </span>
                </div>

                <div className={showSignInHint
                    ? `col-span-2 lg:col-span-2 lg:row-start-2`
                    : `col-span-2 lg:col-span-1 lg:ml-auto`}
                >
                    <RatedFilterTabs
                        value={ratedFilter}
                        onChange={onChangeRatedFilter}
                    />
                </div>

                {showSignInHint && (
                    <div className="col-span-2 w-full rounded-[1.35rem] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50 sm:px-5 lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:ml-auto lg:max-w-md lg:text-right">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/90">
                            {t('personalMatchHistory', 'Personal Match History')}
                        </div>

                        <div className="mt-2 leading-6 text-amber-50/85">
                            {t('signInWithDiscordToUnlockYourOwnMatchHistory', 'Sign in with Discord to unlock your own match history.')}
                        </div>
                    </div>
                )}
            </div>

            <section className="flex md:min-h-0 md:h-full min-w-0 flex-col p-0 scrollbar-gutter-stable py-2 px-4 sm:px-6">
                {isLoading ? (
                    <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center text-slate-300">
                        {t('loadingFinishedGames', 'Loading finished games...')}
                    </div>
                ) : requiresSignIn ? (
                    <div className="flex flex-1 items-center justify-center rounded-3xl border border-amber-300/20 bg-amber-400/10 px-6 py-8 text-center text-amber-50">
                        <div>
                            <p className="text-lg font-semibold text-white">
                                {t('signInToViewYourOwnMatchHistory', 'Sign in to view your own match history.')}
                            </p>

                            <p className="mt-3 text-sm leading-6 text-amber-50/80">
                                {t('youHaveToLoginInOrderToViewYourPersonalMatchHistory', 'You have to login in order to view your personal match history.')}
                            </p>
                        </div>
                    </div>
                ) : errorMessage ? (
                    <div className="flex flex-col flex-1 items-center justify-center rounded-3xl border border-rose-300/20 bg-rose-500/10 px-6 py-8 text-center text-rose-100">
                        <p className="text-lg font-semibold">
                            {t('couldNotLoadFinishedGames', 'Could not load finished games.')}
                        </p>

                        <p className="mt-3 text-sm leading-6 text-rose-100/85">
                            {errorMessage}
                        </p>
                    </div>
                ) : games.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center text-slate-300">
                        <div>
                            <p className="text-lg font-semibold text-white">
                                {isOwnArchive ? t('youHaveNotFinishedAnySignedinMatchesYet', 'You have not finished any signed-in matches yet.') : t('noFinishedGamesAreStoredYet', 'No finished games are stored yet.')}
                            </p>

                            <p className="mt-3 text-sm leading-6 text-slate-400">
                                {isOwnArchive
                                    ? t('onceYouCompleteAMatchWhileLoggedInItWillAppearHereAutomatically', 'Once you complete a match while logged in, it will appear here automatically.')
                                    : t('onceMongodbbackedHistoryIsAvailableAndMatchesFinishTheyWillShowUpHereAutomatically', 'Once MongoDB-backed history is available and matches finish, they will show up here automatically.')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-1 flex-col gap-6 overflow-hidden">
                        <div className="md:min-h-0 flex-1 space-y-4 md:overflow-y-auto overscroll-contain pr-1">
                            {games.map((game) => (
                                <FinishedGameCard
                                    key={game.id}
                                    game={game}
                                    context={isOwnArchive ? `user-history` : `history`}
                                    currentProfileId={currentProfileId}
                                />
                            ))}
                        </div>

                        <div className="@container shrink-0">
                            <PageNavigation
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onChangePage={onChangePage}
                            />

                            <div className="mt-3 text-xs text-slate-400 sm:text-right sm:text-sm">
                                {isOwnArchive
                                    ? t('showingPersonalMatches', 'Showing {{pageStart}} - {{pageEnd}} of {{totalGames}} personal matches', { pageStart, pageEnd, totalGames })
                                    : t('showingArchivedMatches', 'Showing {{pageStart}} - {{pageEnd}} of {{totalGames}} archived matches', { pageStart, pageEnd, totalGames })}
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </PageCorpus>
    );
}

export default FinishedGamesScreen;
