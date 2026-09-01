import AccountPreferencesScreen from '../components/AccountPreferencesScreen';
import PageMetadata, { DEFAULT_PAGE_TITLE } from '../components/PageMetadata';
import { useTranslation } from 'react-i18next'

function AccountPreferencesRoute() {
    const { t } = useTranslation()
    return (
        <>
            <PageMetadata
                title={t('accountPreferencesDefault_page_title', 'Account Preferences • {{DEFAULT_PAGE_TITLE}}', { DEFAULT_PAGE_TITLE })}
                description={t('manageYourHexoAccountPreferences', 'Manage your HeXO account preferences.')}
                robots="noindex, nofollow"
            />

            <AccountPreferencesScreen />
        </>
    );
}

export default AccountPreferencesRoute;
