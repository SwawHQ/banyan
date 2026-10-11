import {firstPaintCommand} from '../first-paint/options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../first-paint/check.mjs';
const spec=firstPaintCommand('check/browser/canvas/first-paint.webkit','Check page startup, root selection and retained columns before external scripts run in WebKit.');
try {await runBrowserCheck(spec,check,loadWebkit);}
catch(error){console.error(error.message);process.exitCode=1;}
