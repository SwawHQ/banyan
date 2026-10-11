import {cspCommand} from '../csp/options.mjs';
import {runBrowserCheck} from '../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../_shared/browser/runtime.mjs';
import {check} from '../csp/check.mjs';
const spec = cspCommand('check/browser/csp.webkit','Check enforced CSP and browser violations on the selected page in WebKit.');
try { await runBrowserCheck(spec,check,loadWebkit); }
catch (error) { console.error(error.message); process.exitCode=1; }
