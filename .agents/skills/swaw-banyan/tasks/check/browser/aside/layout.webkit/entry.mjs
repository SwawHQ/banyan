import {layoutCommand} from '../layout/options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../layout/check.mjs';
const spec=layoutCommand('check/browser/aside/layout.webkit','Check aside column placement, spacing, width and wrapping in WebKit.');
try {await runBrowserCheck(spec,check,loadWebkit);}
catch(error){console.error(error.message);process.exitCode=1;}
