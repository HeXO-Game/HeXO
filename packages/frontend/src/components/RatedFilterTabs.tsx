import { type RatedFilter, ratedFilterOptions } from '../utils/ratedFilter';

type RatedFilterTabsProps = {
    value: RatedFilter
    onChange: (value: RatedFilter) => void
};

export default function RatedFilterTabs({
    value,
    onChange,
}: Readonly<RatedFilterTabsProps>) {
    return (
        <div className="inline-flex w-full max-w-max rounded-full border border-white/10 bg-slate-900 p-1">
            {ratedFilterOptions.map((filterOption) => {
                const isActive = value === filterOption.value;
                return (
                    <button
                        key={filterOption.value}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => onChange(filterOption.value)}
                        className={
                            `rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition sm:px-5 ${
                                isActive
                                    ? `bg-sky-300 text-slate-950`
                                    : `cursor-pointer text-slate-300 hover:bg-slate-800 hover:text-white`
                            }`
                        }
                    >
                        {filterOption.label}
                    </button>
                );
            })}
        </div>
    );
}
