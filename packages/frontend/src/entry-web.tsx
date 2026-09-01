import './index.css';
import 'react-toastify/dist/ReactToastify.css';
import './i18n';

import { initializeOpenReplay, trackOpenReplayError } from './openReplay';
import { installSoundEffects } from './soundEffects';

installSoundEffects();
initializeOpenReplay();

const start = performance.now();
import(`./main`).then(() => {
    console.log(`App loaded in %dms`, performance.now() - start);
}).catch(error => {
    trackOpenReplayError(error, {
        source: `entry_web_import`,
    });
    console.error(error);
    alert(`Failed to load app.\nPlease reload!`);
});
