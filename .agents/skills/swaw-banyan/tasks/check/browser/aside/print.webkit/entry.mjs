import {printCommand} from '../print/options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../print/check.mjs';
const spec=printCommand('check/browser/aside/print.webkit','Check printed article and aside placement without screen controls or clipping in WebKit.');
try {await runBrowserCheck(spec,check,loadWebkit);}
catch(error){console.error(error.message);process.exitCode=1;}
