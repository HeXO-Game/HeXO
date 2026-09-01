import PageMetadata, { DEFAULT_PAGE_TITLE } from '../components/PageMetadata';
import RulesScreen from '../components/RulesScreen';
import { useTranslation } from 'react-i18next'

function RulesRoute() {
    const { t } = useTranslation()
    return (
        <>
            <PageMetadata
                title={t('rulesDefault_page_title', 'Rules • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE })}
                description={t('learnTheHexoRulesTurnOrderLegalPlacementsThe8cellPlacementLimitAndHowToWinWith6InARow', 'Learn the HeXO rules: turn order, legal placements, the 8-cell placement limit, and how to win with 6 in a row.')}
            />

            <RulesScreen />
        </>
    );
}

export default RulesRoute;
