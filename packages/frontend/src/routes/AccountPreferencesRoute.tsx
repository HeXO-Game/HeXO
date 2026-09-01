import AccountPreferencesScreen from '../components/AccountPreferencesScreen';
import PageMetadata, { DEFAULT_PAGE_TITLE } from '../components/PageMetadata';

function AccountPreferencesRoute() {
    return (
        <>
            <PageMetadata
                title={`Account Preferences • ${DEFAULT_PAGE_TITLE}`}
                description="Manage your HeXO account preferences."
                robots="noindex, nofollow"
            />

            <AccountPreferencesScreen />
        </>
    );
}

export default AccountPreferencesRoute;
