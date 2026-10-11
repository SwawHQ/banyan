import {browserCommand} from '../../../_shared/browser/options.mjs';
import {runBrowserCheck} from '../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../_shared/browser/runtime.mjs';
import {check} from '../home/check.mjs';
const spec = browserCommand('check/browser/home.webkit','Check the rendered home page, asset loading and JavaScript errors in WebKit.');
try { await runBrowserCheck(spec,check,loadWebkit); }
catch (error) { console.error(error.message); process.exitCode=1; }
