import {contrastCommand} from '../contrast/options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../contrast/check.mjs';
const spec = contrastCommand('check/browser/palette/contrast.webkit','Check light/dark prose and code text contrast in WebKit.');
try { await runBrowserCheck(spec,check,loadWebkit); }
catch (error) { console.error(error.message); process.exitCode=1; }
