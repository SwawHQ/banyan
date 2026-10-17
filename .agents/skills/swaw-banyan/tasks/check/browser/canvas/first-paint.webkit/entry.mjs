import {firstPaintCommand} from '../first-paint/options.mjs';
import {runBrowserCheck} from '../../_shared/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../first-paint/check.mjs';
const spec=firstPaintCommand('check/browser/canvas/first-paint.webkit');
try {await runBrowserCheck(spec,check,loadWebkit);}
catch(error){console.error(error.message);process.exitCode=1;}
