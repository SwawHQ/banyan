import {openCommand} from '../open/options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../open/check.mjs';
const spec=openCommand('check/browser/canvas/open.webkit','Check article opening, source ancestry/sort, current-entry clicks and native history in WebKit.');
spec.options=spec.options.filter(option=>option.name!=='drag');
spec.examples=spec.examples.filter(example=>!example.includes('--drag'));
try {await runBrowserCheck(spec,check,loadWebkit);}
catch(error){console.error(error.message);process.exitCode=1;}
