import {browserCommand} from '../_shared/options.mjs';
import {runBrowserCheck} from '../_shared/run.mjs';
import {loadWebkit} from '../../../_shared/browser/runtime.mjs';
import {check} from '../home/check.mjs';
const spec = browserCommand('check/browser/home.webkit');
try { await runBrowserCheck(spec,check,loadWebkit); }
catch (error) { console.error(error.message); process.exitCode=1; }
