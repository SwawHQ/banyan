import {scrollCommand} from './options.mjs';
import {runBrowserCheck} from '../../_shared/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
import {check} from './check.mjs';
const spec=scrollCommand('check/browser/canvas/scroll');
try {await runBrowserCheck(spec,check,loadChromium);}
catch(error){console.error(error.message);process.exitCode=1;}
