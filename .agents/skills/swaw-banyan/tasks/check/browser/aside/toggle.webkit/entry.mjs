import {toggleCommand} from '../toggle/options.mjs';
import {runBrowserCheck} from '../../_shared/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../toggle/check.mjs';
const spec=toggleCommand('check/browser/aside/toggle.webkit');
try {await runBrowserCheck(spec,check,loadWebkit);}
catch(error){console.error(error.message);process.exitCode=1;}
