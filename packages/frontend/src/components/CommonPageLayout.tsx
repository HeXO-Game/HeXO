import { Button, buttonVariants } from '@/components/ui/button';
import { CSSProperties, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { toast } from 'react-toastify';

import { useQueryAccount } from '../query/accountClient';
import { signInWithDiscord, signOutAccount } from '../query/authClient';
import { cn } from '../utils/cn';
import AccountPicture from './AccountPicture';
import AppErrorBoundary from './AppErrorBoundary';
import DevAuthPanel from './DevAuthPanel';
import { useTranslation } from 'react-i18next'

function showErrorToast(message: string) {
    toast.error(message, {
        toastId: `error:${message}`,
    });
}

const OFFICIAL_DISCORD_INVITE_URL = `https://discord.gg/mBAmFyFE6z`;

const heroHexGridStyle: CSSProperties = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='104' viewBox='0 0 120 104' fill='none'%3E%3Cg stroke='rgba(148,163,184,0.16)' stroke-width='1'%3E%3Cpath d='M30 1l29 17v34L30 69 1 52V18L30 1Z'/%3E%3Cpath d='M89 1l29 17v34L89 69 60 52V18L89 1Z'/%3E%3Cpath d='M60 35l29 17v34l-29 17L31 86V52l29-17Z'/%3E%3C/g%3E%3C/svg%3E")`,
    backgroundSize: `120px 104px`,
};

function HexBackdrop() {
    return (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-20" style={heroHexGridStyle} />
        </div>
    );
}

function NavigationLink({
    to,
    label,
    end = false,
}: Readonly<{
    to: string
    label: string
    end?: boolean
}>) {
    return (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive
                ? `bg-sky-400/12 text-sky-100`
                : `text-slate-300 hover:bg-sky-400/8 hover:text-sky-50`}`}
        >
            {label}
        </NavLink>
    );
}

function MenuLink({
    to,
    label,
    target,
    onSelect,
}: Readonly<{
    to: string
    label: string
    target?: string
    onSelect?: () => void
}>) {
    return (
        <NavLink
            to={to}
            target={target}
            onClick={onSelect}
            className={({ isActive }) => `block rounded-sm px-3 py-2.5 text-sm transition ${isActive
                ? `bg-sky-400/12 text-sky-100`
                : `text-slate-300 hover:bg-sky-400/8 hover:text-sky-50`}`
            }
        >
            {label}
        </NavLink>
    );
}

function DiscordLink({
    className = ``,
}: Readonly<{
    className?: string
}>) {
    const { t } = useTranslation()
    return (
        <a
            href={OFFICIAL_DISCORD_INVITE_URL}
            target="_blank"
            rel="noreferrer"
            title={t('openTheOfficialDiscordServerInANewTab', 'Open the official Discord server in a new tab')}
            className={cn("flex flex-row gap-1 rounded-sm px-3 py-2.5 text-sm transition text-slate-300 hover:text-sky-50 fill-slate-300 hover:fill-sky-50", "py-2 hover:bg-[#5865F2]", className)}
        >
            <svg
                viewBox="0 -28.5 256 256"
                version="1.1"
                className="h-4 w-4 shrink-0 stroke-current self-center mt-0.5 mr-1"
            >
                <g>
                    <path d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z" fillRule="nonzero">

                    </path>
                </g>
            </svg>

            <span className={"self-center"}>
                {t('discord', 'Discord')}
            </span>
        </a>
    );
}


function CommonPageLayout({ limitWidth, hideMobile }: { limitWidth: boolean, hideMobile?: boolean }) {
    const { t } = useTranslation()
    const location = useLocation();
    const accountQuery = useQueryAccount({ enabled: true });
    const account = accountQuery.data?.user ?? null;
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const headerRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        setIsAccountMenuOpen(false);
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!isAccountMenuOpen && !isMobileMenuOpen) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (!headerRef.current?.contains(event.target as Node)) {
                setIsAccountMenuOpen(false);
                setIsMobileMenuOpen(false);
            }
        };

        document.addEventListener(`pointerdown`, handlePointerDown);
        return () => document.removeEventListener(`pointerdown`, handlePointerDown);
    }, [isAccountMenuOpen, isMobileMenuOpen]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === `Escape`) {
                setIsAccountMenuOpen(false);
                setIsMobileMenuOpen(false);
            }
        };

        document.addEventListener(`keydown`, handleKeyDown);
        return () => document.removeEventListener(`keydown`, handleKeyDown);
    }, []);

    const handleSignIn = async () => {
        try {
            await signInWithDiscord();
        } catch (error) {
            console.error(`Failed to start Discord sign in:`, error);
            showErrorToast(error instanceof Error ? error.message : `Failed to start Discord sign in.`);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOutAccount();
        } catch (error) {
            console.error(`Failed to sign out:`, error);
            showErrorToast(error instanceof Error ? error.message : `Failed to sign out.`);
        }
    };

    return (
        <div className="absolute inset-0 overflow-auto flex min-h-dvh flex-col bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_24%),linear-gradient(135deg,#020617,#0f172a_45%,#111827)] text-white">
            <header
                ref={headerRef}
                className={cn(
                    `sm:flex sticky top-0 z-40 border-b border-sky-300/10 bg-slate-950/85 backdrop-blur-xl`,
                    hideMobile && `hidden`,
                )}
            >
                <div className="mx-auto flex flex-row w-full max-w-368 gap-4 px-2 py-2 lg:py-4 lg:px-6 items-center justify-between">
                    <NavLink
                        to="/"
                        end
                        className="inline-flex items-center gap-3 rounded-lg px-1 py-1 text-white transition hover:text-sky-100"
                    >
                        <img
                            src="/favicon.png"
                            alt=""
                            aria-hidden="true"
                            className="h-9 w-9 shrink-0 rounded-lg"
                        />

                        <span className="min-w-0 text-left leading-tight">
                            <span className="font-semibold text-sky-100">
                                {t('hexo2', 'HEXO')}
                            </span>

                            <span className="block text-xs font-semibold text-sky-100">
                                <span className="mr-1">
                                    {t('infiniteHexagonal', 'Infinite Hexagonal')}
                                </span>

                                <span className="inline-block">
                                    {t('tictactoe', 'Tic-Tac-Toe')}
                                </span>
                            </span>
                        </span>
                    </NavLink>

                    <div className="flex flex-row items-center gap-4 ml-auto">
                        <nav className="hidden xl:flex flex-wrap items-center gap-2" aria-label="Primary">
                            <NavigationLink to="/rules" label="Rules" />
                            <NavigationLink to="/sandbox" label="Sandbox" />
                            <NavigationLink to="/games" label={t('matchHistory', 'Match History')} />
                            <NavigationLink to="/leaderboard" label="Leaderboard" />
                            <NavigationLink to="/tournaments" label="Tournaments" />
                            <DiscordLink />
                        </nav>

                        <DevAuthPanel account={account} />

                        {accountQuery.isLoading ? (
                            <div className="self-start rounded-lg px-3 py-2 text-sm text-slate-400 lg:self-auto">
                                {t('loadingAccount', 'Loading Account')}
                            </div>
                        ) : account ? (
                            <div className="self-start lg:relative lg:self-auto">
                                <Button
                                    type="button"
                                    aria-haspopup="menu"
                                    aria-expanded={isAccountMenuOpen}
                                    onClick={() => { setIsAccountMenuOpen((open) => !open); setIsMobileMenuOpen(false); }}
                                    variant="ghost" size="default" className="gap-3 text-left"
                                >
                                    <AccountPicture username={account.username} image={account.image} />

                                    <div className="min-w-0 hidden sm:block">
                                        <div className="truncate text-sm font-semibold text-white">
                                            {account.username}
                                        </div>

                                        <div className="text-xs text-sky-200/70">
                                            {t('account', 'Account')}
                                        </div>
                                    </div>

                                    <svg
                                        aria-hidden="true"
                                        viewBox="0 0 20 20"
                                        className={`hidden sm:block h-4 w-4 text-slate-300 transition ${isAccountMenuOpen ? `rotate-180` : ``}`}
                                    >
                                        <path
                                            d="M5.5 7.5 10 12l4.5-4.5"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="1.8"
                                        />
                                    </svg>
                                </Button>

                                {isAccountMenuOpen && (
                                    <div className="border-t mt-2 lg:mt-4 border-white/10 px-4 py-4 sm:px-6 absolute bg-slate-950 lg:p-0 lg:border-none lg:bg-transparent right-0 left-0 lg:left-auto lg:w-[18em] lg:text-right z-50">
                                        <div
                                            role="menu"
                                            className={` bg-slate-950 mx-auto w-full max-w-368 rounded-md lg:border border-sky-300/10 p-2 shadow-[0_18px_50px_rgba(2,6,23,0.45)] backdrop-blur-xl`}
                                        >
                                            <div className="space-y-1">
                                                <MenuLink to="/tournaments" label="Tournaments" onSelect={() => setIsAccountMenuOpen(false)} />
                                                <MenuLink to="/account/games" label={t('matchHistory', 'Match History')} onSelect={() => setIsAccountMenuOpen(false)} />
                                                <MenuLink to="/account/preferences" label="Preferences" onSelect={() => setIsAccountMenuOpen(false)} />
                                                <MenuLink to="/account/profile" label="Profile" onSelect={() => setIsAccountMenuOpen(false)} />
                                            </div>

                                            {account.role === `admin` && (
                                                <div className="mt-2 border-t border-amber-300/10 pt-2">
                                                    <MenuLink to="/admin/controls" label={t('adminControls', 'Admin Controls')} onSelect={() => setIsAccountMenuOpen(false)} />
                                                    <MenuLink to="/admin/stats" label={t('adminStatistics', 'Admin Statistics')} onSelect={() => setIsAccountMenuOpen(false)} />
                                                </div>
                                            )}

                                            <div className="mt-2 border-t border-amber-300/10 pt-2">
                                                <Button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsAccountMenuOpen(false);
                                                        void handleSignOut();
                                                    }}
                                                    variant="destructive-soft"
                                                    size="sm"
                                                    className="block py-2.5 w-full text-left lg:text-right rounded-sm"
                                                >
                                                    {t('logout', 'Logout')}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Button
                                type="button"
                                aria-label={t('signInWithDiscord', 'Sign In With Discord')}
                                onClick={() => void handleSignIn()}
                                variant="discord" size="sm" className="self-start lg:self-auto"
                            >
                                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current sm:h-4.5 sm:w-4.5">
                                    <path d="M20.32 4.37A18.13 18.13 0 0 0 15.8 3a12.2 12.2 0 0 0-.58 1.18 16.56 16.56 0 0 0-6.43 0A12.2 12.2 0 0 0 8.21 3a18.05 18.05 0 0 0-4.53 1.37C.81 8.65.03 12.83.42 16.96A18.24 18.24 0 0 0 5.98 19.8c.45-.61.85-1.26 1.2-1.95-.66-.25-1.3-.56-1.9-.92.16-.12.31-.25.46-.38 3.67 1.69 7.65 1.69 11.27 0 .15.13.3.26.46.38-.61.36-1.25.67-1.91.92.35.69.75 1.34 1.2 1.95a18.17 18.17 0 0 0 5.57-2.84c.45-4.79-.77-8.93-3.66-12.59ZM8.68 14.46c-1.1 0-2-.99-2-2.21s.88-2.21 2-2.21c1.11 0 2.01 1 2 2.21 0 1.22-.89 2.21-2 2.21Zm6.64 0c-1.1 0-2-.99-2-2.21s.88-2.21 2-2.21c1.11 0 2.01 1 2 2.21 0 1.22-.89 2.21-2 2.21Z" />
                                </svg>

                                {t('signIn', 'Sign In')}
                            </Button>
                        )}
                    </div>

                    <Button
                        type="button"
                        aria-label={isMobileMenuOpen ? t('closeNavigationMenu', 'Close navigation menu') : t('openNavigationMenu', 'Open navigation menu')}
                        aria-expanded={isMobileMenuOpen}
                        onClick={() => {
                            setIsAccountMenuOpen(false);
                            setIsMobileMenuOpen((open) => !open);
                        }}
                        variant="ghost" size="icon-xl" className="xl:hidden"
                    >
                        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
                            {isMobileMenuOpen ? (
                                <path
                                    d="M5 5l10 10M15 5 5 15"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeWidth="1.8"
                                />
                            ) : (
                                <path
                                    d="M4 6h12M4 10h12M4 14h12"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeWidth="1.8"
                                />
                            )}
                        </svg>
                    </Button>
                </div>

                {isMobileMenuOpen && (
                    <div className="border-t border-white/10 px-4 py-4 sm:px-6 xl:hidden absolute bg-slate-950 right-0 left-0 z-50 shadow-[0_18px_50px_rgba(2,6,23,0.45)] backdrop-blur-xl">
                        <div className="mx-auto w-full max-w-368 space-y-2 rounded-2xl p-2 shadow-[0_18px_50px_rgba(2,6,23,0.4)]">
                            <MenuLink to="/rules" label="Rules" onSelect={() => setIsMobileMenuOpen(false)} />
                            <MenuLink to="/games" label={t('matchHistory', 'Match History')} onSelect={() => setIsMobileMenuOpen(false)} />
                            <MenuLink to="/sandbox" label="Sandbox" onSelect={() => setIsMobileMenuOpen(false)} />
                            <MenuLink to="/leaderboard" label="Leaderboard" onSelect={() => setIsMobileMenuOpen(false)} />
                            <MenuLink to="/tournaments" label="Tournaments" onSelect={() => setIsMobileMenuOpen(false)} />
                            <MenuLink to={OFFICIAL_DISCORD_INVITE_URL} label={t('discordServer', 'Discord Server')} target="_blank" />
                        </div>
                    </div>
                )}
            </header>

            <main className={`mx-auto flex w-full ${limitWidth ? `max-w-368` : ``} min-h-0 flex-1 flex-col`}>
                <HexBackdrop />

                <AppErrorBoundary>
                    <Outlet />
                </AppErrorBoundary>
            </main>
        </div>
    );
}

export default CommonPageLayout;
