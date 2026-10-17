import {bfcacheCommand,launchOptions} from './options.mjs';
import {check} from './check.mjs';
import {runBrowserCheck} from '../../_shared/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
const spec=bfcacheCommand('check/browser/language/bfcache');
try {await runBrowserCheck(spec,check,loadChromium,process.argv.slice(2),launchOptions);}
catch(error) {console.error(error.message);process.exitCode=1;}
