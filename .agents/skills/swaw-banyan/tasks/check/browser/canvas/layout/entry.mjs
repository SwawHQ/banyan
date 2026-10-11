import {canvasLayoutCommand} from './options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
import {check} from './check.mjs';
const spec=canvasLayoutCommand('check/browser/canvas/layout','Check horizontal canvas columns, prose fit, navigation and footer layout in Chromium.');
try {await runBrowserCheck(spec,check,loadChromium);}
catch(error){console.error(error.message);process.exitCode=1;}
