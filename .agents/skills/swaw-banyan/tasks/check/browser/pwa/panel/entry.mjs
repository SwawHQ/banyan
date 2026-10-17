import {panelCommand} from './options.mjs';
import {check} from './check.mjs';
import {runBrowserCheck} from '../../_shared/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
const spec=panelCommand('check/browser/pwa/panel');
try {await runBrowserCheck(spec,check,loadChromium);}
catch(error) {console.error(error.message);process.exitCode=1;}
