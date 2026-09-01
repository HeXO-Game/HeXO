import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDownIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trackOpenReplayLanguage } from '../openReplay';

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

function SouthKoreanFlag() {
    return (
        <svg aria-hidden="true" viewBox="0 0 72 48" className="size-auto h-4 w-6 overflow-hidden rounded-[2px] shadow-sm">
            <path fill="#fff" d="M0 0h72v48H0z" />
            <circle cx="36" cy="24" r="9" fill="#cd2e3a" />
            <path fill="#0047a0" d="M27 24a9 9 0 0 0 18 0 4.5 4.5 0 0 1-9 0 4.5 4.5 0 0 0-9 0Z" />
            <g stroke="#000" strokeWidth="2.4">
                <path d="m12 12 13-9m-11 12 13-9m-11 12 13-9M43 39l13-9M45 42l13-9M47 45l13-9" />
                <path d="m47 4 4 3m2 1 4 3m-12-4 4 3m2 1 4 3m-12-4 4 3m2 1 4 3M15 30l4 3m2 1 4 3m-12-4 9 6m-11-3 4 3m2 1 4 3" />
            </g>
        </svg>
    );
}

function ChineseFlag() {
    const smallStar = `M0-1.5.35-.48 1.43-.46.57.18.88 1.21 0 .6-.88 1.21-.57.18-1.43-.46-.35-.48Z`;

    return (
        <svg aria-hidden="true" viewBox="0 0 30 20" className="size-auto h-4 w-6 overflow-hidden rounded-[2px] shadow-sm">
            <path fill="#ee1c25" d="M0 0h30v20H0z" />
            <path fill="#ffff00" d="m5 2 1.18 3.63h3.82L6.91 7.88l1.18 3.63L5 9.27l-3.09 2.24 1.18-3.63L0 5.63h3.82Z" />
            <path fill="#ffff00" d={smallStar} transform="translate(11 3) rotate(23)" />
            <path fill="#ffff00" d={smallStar} transform="translate(13 6) rotate(46)" />
            <path fill="#ffff00" d={smallStar} transform="translate(13 10) rotate(69)" />
            <path fill="#ffff00" d={smallStar} transform="translate(11 13) rotate(92)" />
        </svg>
    );
}

const LANGUAGES = [
    { code: `en`, label: `English`, Flag: BritishFlag },
    { code: `de`, label: `Deutsch`, Flag: GermanFlag },
    { code: `ko-KR`, label: `한국어`, Flag: SouthKoreanFlag },
    { code: `zh-CN`, label: `简体中文`, Flag: ChineseFlag },
] as const;

type LanguageCode = typeof LANGUAGES[number]['code'];

function isLanguageCode(value: unknown): value is LanguageCode {
    return typeof value === `string` && LANGUAGES.some(({ code }) => code === value);
}

function LanguageSelector() {
    const { i18n, t } = useTranslation();
    const activeLanguage = LANGUAGES.find(({ code }) => code.toLowerCase() === i18n.resolvedLanguage?.toLowerCase()) ?? LANGUAGES[0];

    const [open, setOpen] = useState(false);
    const previousLanguage = useRef<LanguageCode | undefined>(undefined);

    useEffect(() => {
        const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (isLanguageCode(savedLanguage)) {
            void i18n.changeLanguage(savedLanguage);
        }
    }, [i18n]);

    useEffect(() => {
        document.documentElement.lang = activeLanguage.code;
        trackOpenReplayLanguage(activeLanguage.code, previousLanguage.current);
        previousLanguage.current = activeLanguage.code;
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
