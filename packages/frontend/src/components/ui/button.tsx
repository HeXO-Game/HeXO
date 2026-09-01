import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/utils/cn';

const buttonVariants = cva(
    `inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 border border-transparent text-sm font-semibold whitespace-nowrap transition outline-none select-none focus-visible:border-sky-200 focus-visible:ring-2 focus-visible:ring-sky-300/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 aria-invalid:border-rose-300 aria-invalid:ring-2 aria-invalid:ring-rose-400/30 [&_svg]:pointer-events-none [&_svg]:shrink-0`,
    {
        variants: {
            variant: {
                default: `bg-sky-400 text-slate-950 shadow-lg hover:-translate-y-0.5 hover:bg-sky-300`,
                secondary: `bg-amber-300 text-slate-950 shadow-lg hover:-translate-y-0.5 hover:bg-amber-200`,
                outline: `border-white/15 bg-white/8 text-white hover:-translate-y-0.5 hover:bg-white/14`,
                ghost: `bg-transparent text-slate-200 hover:bg-white/8 hover:text-white`,
                destructive: `bg-rose-500 text-white shadow-lg hover:-translate-y-0.5 hover:bg-rose-400`,
                'destructive-soft': `border-rose-300/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20`,
                success: `bg-emerald-400 text-slate-950 shadow-lg hover:-translate-y-0.5 hover:bg-emerald-300`,
                'success-soft': `border-emerald-300/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20`,
                warning: `border-amber-300/25 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20`,
                info: `border-sky-300/25 bg-sky-400/10 text-sky-100 hover:bg-sky-400/20`,
                muted: `bg-slate-700 text-white shadow-lg hover:bg-slate-600`,
                discord: `bg-[#5865F2] text-white hover:-translate-y-0.5 hover:bg-[#6f7cff]`,
                violet: `bg-violet-400 text-slate-950 shadow-lg hover:-translate-y-0.5 hover:bg-violet-300`,
                link: `rounded-none border-0 bg-transparent text-sky-200 underline-offset-4 hover:text-sky-100 hover:underline`,
                card: `rounded-2xl border-white/10 bg-white/6 text-white hover:-translate-y-0.5 hover:border-sky-300/30 hover:bg-white/10 aria-pressed:border-sky-300/35 aria-pressed:bg-sky-300/10 aria-pressed:shadow-[0_8px_18px_rgba(14,165,233,0.1)]`,
                tab: `rounded-md bg-transparent text-slate-400 hover:text-slate-200 aria-pressed:bg-white/12 aria-pressed:text-white aria-pressed:shadow-sm`,
                filter: `bg-transparent border-white/15 text-slate-300 hover:bg-slate-800 hover:text-white aria-pressed:bg-sky-300 aria-pressed:text-slate-950`,
                switch: `justify-start border-white/10 bg-slate-800/90 aria-checked:border-sky-300/50 aria-checked:bg-sky-400/80`,
            },
            size: {
                xxs: `rounded-md px-1.5 py-0.5 text-[9px]`,
                xs: `rounded-md px-2 py-1 text-[10px]`,
                sm: `rounded-lg px-3 py-1.5 text-xs`,
                default: `rounded-lg px-5 py-2.5`,
                lg: `rounded-lg px-6 py-3 text-sm uppercase tracking-[0.18em]`,
                xl: `rounded-lg px-5 py-4 text-sm uppercase tracking-[0.16em]`,

                'icon-sm': `rounded-md size-8 p-0`,
                icon: `rounded-xl size-10 p-0`,
                'icon-lg': `rounded-xl size-12 p-0`,
                'icon-xl': `rounded-xl size-15 p-0`,

                bare: `p-0`,
            },
        },
        defaultVariants: {
            variant: `default`,
            size: `default`,
        },
    },
);

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: ButtonProps) {
    return (
        <button
            data-slot="button"
            className={cn(buttonVariants({ variant, size }), className)}
            {...props}
        />
    );
}

export { Button, buttonVariants };
export type { ButtonProps };
