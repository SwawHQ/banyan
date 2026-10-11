import {appearanceCommand} from '../appearance/options.mjs';
import {runBrowserCheck} from '../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../_shared/browser/runtime.mjs';
import {check} from '../appearance/check.mjs';
const spec = appearanceCommand('check/browser/appearance.webkit','Check appearance choices, persistence, system preference, history and cross-tab sync in WebKit.');
try { await runBrowserCheck(spec,check,loadWebkit); }
catch (error) { console.error(error.message); process.exitCode=1; }
