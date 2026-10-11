import {isolationCommand} from './options.mjs';
import {check} from './check.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
const spec=isolationCommand('check/browser/breadcrumb/isolation','Check independent breadcrumb and main collection sorting in Chromium.');
try {await runBrowserCheck(spec,check,loadChromium);}
catch(error) {console.error(error.message);process.exitCode=1;}
