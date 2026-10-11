import {toggleCommand} from '../toggle/options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../toggle/check.mjs';
const spec=toggleCommand('check/browser/aside/toggle.webkit','Check aside disclosure, focus, reading position and native canvas clamping in WebKit.');
try {await runBrowserCheck(spec,check,loadWebkit);}
catch(error){console.error(error.message);process.exitCode=1;}
