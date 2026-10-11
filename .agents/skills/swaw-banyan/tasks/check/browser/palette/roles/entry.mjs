import {paletteCommand} from '../options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
import {check} from './check.mjs';
const spec = paletteCommand('check/browser/palette/roles','Check derived neutral surfaces and scoped palette overrides in Chromium.');
try { await runBrowserCheck(spec,check,loadChromium); }
catch (error) { console.error(error.message); process.exitCode=1; }
