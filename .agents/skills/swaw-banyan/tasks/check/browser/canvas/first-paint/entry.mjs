import {firstPaintCommand} from './options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
import {check} from './check.mjs';
const spec=firstPaintCommand('check/browser/canvas/first-paint','Check page startup, root selection and retained columns before external scripts run in Chromium.');
try {await runBrowserCheck(spec,check,loadChromium);}
catch(error){console.error(error.message);process.exitCode=1;}
