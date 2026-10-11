import {historyCommand} from './options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
import {check} from './check.mjs';
const spec=historyCommand('check/browser/canvas/history','Check native back/forward/reload positions and in-place sorting in Chromium.');
try {await runBrowserCheck(spec,check,loadChromium);}
catch(error){console.error(error.message);process.exitCode=1;}
