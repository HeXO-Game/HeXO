import { Button } from '@/components/ui/button';
import { type RatedFilter, ratedFilterOptions } from '../utils/ratedFilter';
import { ButtonGroup } from './ui/button-group';

type RatedFilterTabsProps = {
    value: RatedFilter
    onChange: (value: RatedFilter) => void
};

export default function RatedFilterTabs({
    value,
    onChange,
}: Readonly<RatedFilterTabsProps>) {
    return (
        <ButtonGroup>
            {ratedFilterOptions.map((filterOption) => {
                const isActive = value === filterOption.value;
                return (
                    <Button
                        key={filterOption.value}
                        type="button"
                        variant="filter"
                        size="sm"
                        aria-pressed={isActive}
                        onClick={() => onChange(filterOption.value)}
                    >
                        {filterOption.label}
                    </Button>
                );
            })}
        </ButtonGroup>
    );
}
