import {sortCommand} from './options.mjs';
import {check} from './check.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
const spec=sortCommand('check/browser/breadcrumb/sort','Check breadcrumb sorting, retained nodes, focus, scroll and shared prefetch selectors in Chromium.');
try {await runBrowserCheck(spec,check,loadChromium);}
catch(error) {console.error(error.message);process.exitCode=1;}
