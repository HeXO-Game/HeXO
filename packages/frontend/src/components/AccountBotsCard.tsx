import type { BotAccount } from '@ih3t/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next'

import {
    createAccountBot,
    deleteAccountBot,
    rotateAccountBotToken,
    useQueryAccountBots,
} from '../query/accountClient';
import { formatCalendarDate, useIntlFormatProvider } from '../utils/dateTime';
import { Button } from './ui/button';

function BotRow({
    bot,
    busy,
    onRotate,
    onDelete,
}: {
    bot: BotAccount;
    busy: boolean;
    onRotate: () => void;
    onDelete: () => void;
}) {
    const { t } = useTranslation()
    const intlFormatProvider = useIntlFormatProvider();

    return (
        <li className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
            <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-white">{bot.username}</span>
                {bot.tokenRotatedAt !== null && (
                    <span className="text-xs text-slate-400">
                        {t('botTokenIssued', 'Token issued {{date}}', {
                            date: formatCalendarDate(intlFormatProvider, bot.tokenRotatedAt),
                        })}
                    </span>
                )}
            </span>
            <span className="flex shrink-0 gap-2">
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRotate}>
                    {t('rotateToken', 'Rotate token')}
                </Button>
                <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={onDelete}>
                    {t('delete', 'Delete')}
                </Button>
            </span>
        </li>
    );
}

function AccountBotsCard() {
    const { t } = useTranslation()
    const [username, setUsername] = useState(``);
    const [issuedToken, setIssuedToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const queryBots = useQueryAccountBots();

    const onMutationError = (mutationError: Error) => setError(mutationError.message);

    const createBot = useMutation({
        mutationFn: createAccountBot,
        onSuccess: (result) => {
            setError(null);
            setIssuedToken(result.token);
            setUsername(``);
        },
        onError: onMutationError,
    });
    const rotateToken = useMutation({
        mutationFn: rotateAccountBotToken,
        onSuccess: (result) => {
            setError(null);
            setIssuedToken(result.token);
        },
        onError: onMutationError,
    });
    const removeBot = useMutation({
        mutationFn: deleteAccountBot,
        onSuccess: () => {
            setError(null);
            setIssuedToken(null);
        },
        onError: onMutationError,
    });

    const accountBots = queryBots.data;
    if (!accountBots) {
        return queryBots.isError
            ? (
                <section className="max-w-xl rounded-3xl border border-white/10 bg-slate-950/45 p-5">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
                        {t('botAccounts', 'Bot Accounts')}
                    </h3>
                    <p className="mt-2 text-sm text-rose-300">
                        {t('botAccountsUnavailable', 'Bot accounts could not be loaded.')}
                    </p>
                </section>
            )
            : null;
    }

    const { bots, limit } = accountBots;
    const busy = createBot.isPending || rotateToken.isPending || removeBot.isPending;

    return (
        <section className="max-w-xl rounded-3xl border border-white/10 bg-slate-950/45 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
                {t('botAccounts', 'Bot Accounts')}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
                {t('botAccountsDescription', 'Bot accounts let a program play on your behalf through the bot API. You can own up to {{limit}}.', { limit })}
            </p>

            {bots.length > 0 && (
                <ul className="mt-4 flex flex-col gap-2">
                    {bots.map(bot => (
                        <BotRow
                            key={bot.id}
                            bot={bot}
                            busy={busy}
                            onRotate={() => rotateToken.mutate(bot.id)}
                            onDelete={() => removeBot.mutate(bot.id)}
                        />
                    ))}
                </ul>
            )}

            <form
                className="mt-4 flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    createBot.mutate(username);
                }}
            >
                <input
                    className="flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    value={username}
                    placeholder={t('botName', 'Bot name')}
                    disabled={busy || bots.length >= limit}
                    onChange={(event) => setUsername(event.target.value)}
                />
                <Button type="submit" disabled={busy || bots.length >= limit || username.trim().length === 0}>
                    {t('createBot', 'Create bot')}
                </Button>
            </form>

            {issuedToken && (
                <p
                    className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100"
                    data-openreplay-obscured
                >
                    {t('botTokenShownOnce', 'Copy this token now, it is not shown again:')}
                    <code className="mt-2 block break-all font-mono text-xs text-white">{issuedToken}</code>
                </p>
            )}

            {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
        </section>
    );
}

export default AccountBotsCard;
