import {appearanceCommand} from './options.mjs';
import {runBrowserCheck} from '../../../_shared/browser/run.mjs';
import {loadChromium} from '../../../_shared/browser/runtime.mjs';
import {check} from './check.mjs';
const spec = appearanceCommand('check/browser/appearance','Check appearance choices, persistence, system preference, history and cross-tab sync in Chromium.');
try { await runBrowserCheck(spec,check,loadChromium); }
catch (error) { console.error(error.message); process.exitCode=1; }
