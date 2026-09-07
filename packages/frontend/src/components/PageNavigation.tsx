import { useTranslation } from 'react-i18next';

import { getVisiblePageNumbers } from '../utils/pagination';
import { Button } from './ui/button';

type PageNavigationProps = {
    currentPage: number
    totalPages: number
    onChangePage: (page: number) => void
};

function PageNavigation({ currentPage, totalPages, onChangePage }: Readonly<PageNavigationProps>) {
    const { t } = useTranslation();
    const visiblePageNumbers = getVisiblePageNumbers(currentPage, totalPages);

    return (
        <div className="grid grid-cols-2 @min-[25em]:flex items-center justify-between gap-2 overflow-visible pb-1 sm:gap-3">
            <Button
                onClick={() => onChangePage(currentPage - 1)}
                disabled={currentPage <= 1}
                variant="outline" size="sm" className="w-[10em]"
            >
                {t('previous', 'Previous')}
            </Button>

            <div className="row-start-2 col-span-2 flex flex-1 flex-nowrap justify-center gap-1 sm:gap-2">
                {visiblePageNumbers.map((pageNumber) => (
                    <Button
                        key={pageNumber}
                        variant={pageNumber === currentPage ? `secondary` : `outline`}
                        size="sm"
                        onClick={() => onChangePage(pageNumber)}
                        aria-current={pageNumber === currentPage ? `page` : undefined}
                        className="min-w-8 sm:min-w-11"
                    >
                        {pageNumber}
                    </Button>
                ))}
            </div>

            <Button
                onClick={() => onChangePage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                variant="outline" size="sm" className="ml-auto w-[10em]"
            >
                {t('next', 'Next')}
            </Button>
        </div>
    );
}

export default PageNavigation;
