import {layoutCommand} from '../layout/options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../layout/check.mjs';
const spec = layoutCommand('check/browser/prose/layout.webkit','Check prose wrapping, links, quotes and ordinary/Chroma table isolation in WebKit.');
try { await runBrowserCheck(spec,check,loadWebkit); }
catch (error) { console.error(error.message); process.exitCode=1; }
