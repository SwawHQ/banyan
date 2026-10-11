import {sourceCommand} from './options.mjs';
import {check} from './check.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
const spec=sourceCommand('check/browser/breadcrumb/source','Check source links without JavaScript, after initialization, on click and reload in Chromium.');
try {await runBrowserCheck(spec,check,loadChromium);}
catch(error) {console.error(error.message);process.exitCode=1;}
