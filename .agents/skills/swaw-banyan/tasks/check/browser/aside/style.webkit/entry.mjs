import {styleCommand} from '../style/options.mjs';
import {runBrowserCheck} from '../../_shared/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../style/check.mjs';
const spec=styleCommand('check/browser/aside/style.webkit');
try {await runBrowserCheck(spec,check,loadWebkit);}
catch(error){console.error(error.message);process.exitCode=1;}
