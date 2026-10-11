import {historyCommand} from '../history/options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../history/check.mjs';
const spec=historyCommand('check/browser/canvas/history.webkit','Check native back/forward/reload positions and in-place sorting in WebKit.');
try {await runBrowserCheck(spec,check,loadWebkit);}
catch(error){console.error(error.message);process.exitCode=1;}
