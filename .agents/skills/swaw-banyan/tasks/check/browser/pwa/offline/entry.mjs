import {offlineCommand} from './options.mjs';
import {check} from './check.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
const spec=offlineCommand('check/browser/pwa/offline','Check real SW registration, first-page caching and offline reload in Chromium.');
try {await runBrowserCheck(spec,check,loadChromium,process.argv.slice(2),{},{serviceWorkers:'allow'});}
catch(error) {console.error(error.message);process.exitCode=1;}
