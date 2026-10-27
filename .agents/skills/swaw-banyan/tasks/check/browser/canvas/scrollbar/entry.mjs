import {scrollbarCommand} from './options.mjs';
import {runBrowserCheck} from '../../_shared/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
import {check} from './check.mjs';
const spec=scrollbarCommand('check/browser/canvas/scrollbar');
try {await runBrowserCheck(spec,check,loadChromium,process.argv.slice(2),{ignoreDefaultArgs:['--hide-scrollbars']});}
catch(error){console.error(error.message);process.exitCode=1;}
