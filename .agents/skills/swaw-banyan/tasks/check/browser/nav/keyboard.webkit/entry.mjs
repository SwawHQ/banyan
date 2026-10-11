import {keyboardCommand} from '../keyboard/options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../keyboard/check.mjs';
const spec = keyboardCommand('check/browser/nav/keyboard.webkit','Check keyboard traversal from root links to the next column at 390px in WebKit.');
try { await runBrowserCheck(spec,check,loadWebkit); }
catch (error) { console.error(error.message); process.exitCode=1; }
