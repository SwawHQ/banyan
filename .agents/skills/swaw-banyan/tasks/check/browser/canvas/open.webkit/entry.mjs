import {openCommand} from '../open/options.mjs';
import {runBrowserCheck} from '../../_shared/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../open/check.mjs';
const spec=openCommand('check/browser/canvas/open.webkit');
spec.options=spec.options.filter(option=>option.name!=='drag');
try {await runBrowserCheck(spec,check,loadWebkit);}
catch(error){console.error(error.message);process.exitCode=1;}
