import {scrollbarCommand} from '../scrollbar/options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../scrollbar/check.mjs';
const spec=scrollbarCommand('check/browser/canvas/scrollbar.webkit','Check scrollbar activity, reading width and aside spacing after resizing in WebKit.');
try {await runBrowserCheck(spec,check,loadWebkit);}
catch(error){console.error(error.message);process.exitCode=1;}
