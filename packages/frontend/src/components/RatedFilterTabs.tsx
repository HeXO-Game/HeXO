import { Button } from '@/components/ui/button';
import { type RatedFilter, ratedFilterOptions } from '../utils/ratedFilter';
import { ButtonGroup } from './ui/button-group';
import { useTranslation } from 'react-i18next';

type RatedFilterTabsProps = {
    value: RatedFilter
    onChange: (value: RatedFilter) => void
};

export default function RatedFilterTabs({
    value,
    onChange,
}: Readonly<RatedFilterTabsProps>) {
    const { t } = useTranslation();
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
                        {filterOption.label(t)}
                    </Button>
                );
            })}
        </ButtonGroup>
    );
}
