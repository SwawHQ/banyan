import {browserCommand} from '../../../_shared/browser/options.mjs';
import {runBrowserCheck} from '../../../_shared/browser/run.mjs';
import {loadChromium} from '../../../_shared/browser/runtime.mjs';
import {check} from './check.mjs';
const spec = browserCommand('check/browser/home','Check the rendered home page, asset loading and JavaScript errors in Chromium.');
try { await runBrowserCheck(spec,check,loadChromium); }
catch (error) { console.error(error.message); process.exitCode=1; }
