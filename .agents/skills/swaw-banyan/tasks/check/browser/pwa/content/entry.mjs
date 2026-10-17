import {command} from './options.mjs';
import {check} from './check.mjs';
import {runBrowserCheck} from '../../_shared/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
try {await runBrowserCheck(command(),check,loadChromium,process.argv.slice(2),{},{serviceWorkers:'allow'});}
catch(error) {console.error(error.message);process.exitCode=1;}
