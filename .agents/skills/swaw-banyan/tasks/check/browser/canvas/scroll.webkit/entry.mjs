import {scrollCommand} from '../scroll/options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../scroll/check.mjs';
const spec=scrollCommand('check/browser/canvas/scroll.webkit','Check document horizontal panning and independent vertical column scrolling in WebKit.');
try {await runBrowserCheck(spec,check,loadWebkit);}
catch(error){console.error(error.message);process.exitCode=1;}
