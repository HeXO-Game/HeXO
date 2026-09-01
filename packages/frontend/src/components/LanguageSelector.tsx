import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDownIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGE_STORAGE_KEY = `language`;

function BritishFlag() {
    return (
        <svg aria-hidden="true" viewBox="0 0 60 36" className="size-auto h-4 w-6 overflow-hidden rounded-[2px] shadow-sm">
            <path fill="#012169" d="M0 0h60v36H0z" />
            <path stroke="#fff" strokeWidth="7.2" d="m0 0 60 36M60 0 0 36" />
            <path stroke="#c8102e" strokeWidth="2.4" d="m0 0 60 36M60 0 0 36" />
            <path stroke="#fff" strokeWidth="12" d="M30 0v36M0 18h60" />
            <path stroke="#c8102e" strokeWidth="7.2" d="M30 0v36M0 18h60" />
        </svg>
    );
}

function GermanFlag() {
    return (
        <svg aria-hidden="true" viewBox="0 0 5 3" className="size-auto h-4 w-6 overflow-hidden rounded-[2px] shadow-sm">
            <path fill="#000" d="M0 0h5v1H0z" />
            <path fill="#dd0000" d="M0 1h5v1H0z" />
            <path fill="#ffce00" d="M0 2h5v1H0z" />
        </svg>
    );
}

const LANGUAGES = [
    { code: `en`, label: `English`, Flag: BritishFlag },
    { code: `de`, label: `Deutsch`, Flag: GermanFlag },
] as const;

type LanguageCode = typeof LANGUAGES[number]['code'];

function isLanguageCode(value: unknown): value is LanguageCode {
    return typeof value === `string` && LANGUAGES.some(({ code }) => code === value);
}

function LanguageSelector() {
    const { i18n, t } = useTranslation();
    const activeLanguage = LANGUAGES.find(({ code }) => code === i18n.resolvedLanguage) ?? LANGUAGES[0];

    const [open, setOpen] = useState(false);

    useEffect(() => {
        const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (isLanguageCode(savedLanguage)) {
            void i18n.changeLanguage(savedLanguage);
        }
    }, [i18n]);

    useEffect(() => {
        document.documentElement.lang = activeLanguage.code;
    }, [activeLanguage.code]);

    const changeLanguage = (nextLanguage: string) => {
        setOpen(false);
        if (!isLanguageCode(nextLanguage)) {
            return;
        }

        localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
        void i18n.changeLanguage(nextLanguage);
    };

    return (
        <DropdownMenu open={open} onOpenChange={value => setOpen(value)}>
            <DropdownMenuTrigger
                title={t('language', 'Language')}
                className="inline-flex cursor-pointer h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-slate-200 outline-none transition hover:border-sky-300/30 hover:bg-white/10 focus-visible:border-sky-300/50 focus-visible:ring-2 focus-visible:ring-sky-300/30"
            >
                <activeLanguage.Flag />
                <ChevronDownIcon aria-hidden="true" className="size-3.5" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-40 border border-white/10 bg-slate-950 text-slate-100">
                <DropdownMenuRadioGroup value={activeLanguage.code} onValueChange={changeLanguage}>
                    {LANGUAGES.map(({ code, label, Flag }) => (
                        <DropdownMenuRadioItem key={code} value={code} className="py-2 cursor-pointer focus:bg-white/10 focus:text-white">
                            <Flag />
                            {label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default LanguageSelector;
