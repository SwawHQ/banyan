import {chaptersCommand} from '../chapters/options.mjs';
import {runBrowserCheck} from '../../_shared/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../chapters/check.mjs';
const spec=chaptersCommand('check/browser/aside/chapters.webkit');
try {await runBrowserCheck(spec,check,loadWebkit);}
catch(error){console.error(error.message);process.exitCode=1;}
