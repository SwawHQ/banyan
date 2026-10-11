import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
import {command} from './options.mjs';
import {check} from './check.mjs';
try {await runBrowserCheck(command(),check,loadChromium,process.argv.slice(2),{},{hasTouch:true,isMobile:true});}
catch(error) {console.error(error.message);process.exitCode=1;}
