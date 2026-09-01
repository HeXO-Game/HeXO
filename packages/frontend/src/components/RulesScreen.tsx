import { buttonVariants } from '@/components/ui/button';
import { Link } from 'react-router';

import PageCorpus from './PageCorpus';
import { useTranslation } from 'react-i18next'

function RulesScreen() {
    const { t } = useTranslation()
    const turnFlow = [
        t('player1StartsWith1HexAtTheCenter', 'Player 1 starts with 1 hex at the center.'),
        t('player2RepliesWith2Hexes', 'Player 2 replies with 2 hexes.'),
        t('afterThatEveryTurnIs2Hexes', 'After that, every turn is 2 hexes.'),
        t('theFirstPlayerToConnectSixHexagonsOnOneAxisWins', 'The first player to connect six hexagons on one axis wins.'),
    ];
    const legalMoveRules = [
        t('placeOnlyOnEmptyHexes', 'Place only on empty hexes.'),
        t('aNewHexCanBePlacedAtMost8CellsApartFromAnyOtherHex', 'A new hex can be placed at most 8 cells apart from any other hex.'),
        t('theBoardIsInfiniteSoPlayCanExpandInAnyDirection', 'The board is infinite, so play can expand in any direction.'),
    ];
    const matchNotes = [
        t('publicAndPrivateLobbiesUseTheSameRules', 'Public and private lobbies use the same rules.'),
        t('ratedGamesAffectTheLeaderboardCasualGamesDoNot', 'Rated games affect the leaderboard; casual games do not.'),
        t('matchesMayUseTurnClocksMatchClocksOrNoClock', 'Matches may use turn clocks, match clocks, or no clock.'),
        t('turnClocksLimitEachTurnButResetAfterEachTurn', 'Turn clocks limit each turn but reset to the initial value after each turn.'),
        t('matchClocksLimitTheTotalTimeButCanBeIncrementedAfterEveryTurn', 'Match clocks limit the total match time but can be incremented after every turn.'),
    ];

    return (
        <PageCorpus
            category={t('howToPlay', 'How To Play')}
            title={t('gameRules', 'Game Rules')}
            description={t('aTwoplayerConnectionGameOnAnInfiniteHexGridMakeAStraightLineOf6BeforeYourOpponent', 'A two-player connection game on an infinite hex grid. Make a straight line of 6 before your opponent.')}
        >
            <div className="flex flex-1 flex-col gap-4 overflow-auto overscroll-contain px-4 pb-4 sm:px-6 sm:pb-6">
                <section className="py-4">
                    <div className="grid gap-6">
                        <section>
                            <p className="text-xs uppercase tracking-[0.3em] text-sky-200/75">
                                {t('gamePlay', 'Game Play')}
                            </p>

                            <ol className="mt-3 grid gap-2">
                                {turnFlow.map((step, index) => (
                                    <li key={step} className="flex gap-3 text-sm leading-6 text-slate-100 sm:text-base">
                                        <span>{index + 1}.</span>
                                        <span>{step}</span>
                                    </li>
                                ))}
                            </ol>
                        </section>

                        <section className="border-t border-white/10 pt-6">
                            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/75">
                                {t('winCondition', 'Win Condition')}
                            </p>

                            <p className="mt-3 text-sm leading-6 text-slate-100 sm:text-base">
                                {t('connect6OfYourOwnHexesInOneStraightLineOnAnyOfThe3BoardAxes', 'Connect 6 of your own hexes in one straight line on any of the 3 board axes.')}
                            </p>

                            <p className="mt-2 text-sm leading-6 text-slate-300 sm:text-base">
                                {t('horizontalAndBothDiagonalDirectionsCount', 'Horizontal and both diagonal directions count.')}
                            </p>
                        </section>

                        <section className="border-t border-white/10 pt-6">
                            <p className="text-xs uppercase tracking-[0.3em] text-amber-200/75">
                                {t('legalPlacements', 'Legal Placements')}
                            </p>

                            <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-100 sm:text-base">
                                {legalMoveRules.map((rule) => (
                                    <li key={rule} className="flex gap-3">
                                        <span className="text-amber-200" aria-hidden="true">
                                            •
                                        </span>

                                        <span>
                                            {rule}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="border-t border-white/10 pt-6">
                            <p className="text-xs uppercase tracking-[0.3em] text-sky-200/75">
                                {t('matchSettings', 'Match Settings')}
                            </p>

                            <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-100 sm:text-base">
                                {matchNotes.map((note) => (
                                    <li key={note} className="flex gap-3">
                                        <span className={` text-sky-200`} aria-hidden="true">
                                            •
                                        </span>

                                        <span>
                                            {note}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>
                </section>

                <section className="rounded-[1.75rem] border border-sky-300/15 bg-sky-400/10 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.3em] text-sky-100/80">
                                {t('readyToTryIt', 'Ready To Try It')}
                            </p>

                            <h2 className="mt-2 text-xl font-black uppercase tracking-[0.08em] text-white sm:text-2xl">
                                {t('jumpIntoAMatch', 'Jump Into A Match')}
                            </h2>

                            <p className="mt-3 max-w-3xl text-sm leading-6 text-sky-50/90 sm:text-base">
                                {t('startALiveLobbyOrUseSandboxModeToTestOpeningsFirst', 'Start a live lobby or use Sandbox Mode to test openings first.')}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link
                                to="/sandbox"
                                className={buttonVariants({ variant: `outline`, size: `lg` })}
                            >
                                {t('openSandbox', 'Open Sandbox')}
                            </Link>

                            <Link
                                to="/"
                                className={buttonVariants({ variant: `secondary`, size: `lg` })}
                            >
                                {t('findAGame', 'Find a game')}
                            </Link>
                        </div>
                    </div>
                </section>
            </div>
        </PageCorpus>
    );
}

export default RulesScreen;
