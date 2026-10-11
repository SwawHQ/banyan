import {anchorsCommand} from '../anchors/options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../anchors/check.mjs';
const spec = anchorsCommand('check/browser/nav/anchors.webkit','Check native heading fragments and skip-to-content at 390px in WebKit.');
try { await runBrowserCheck(spec,check,loadWebkit); }
catch (error) { console.error(error.message); process.exitCode=1; }
