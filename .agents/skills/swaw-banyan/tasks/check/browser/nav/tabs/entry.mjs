import {tabsCommand} from './options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadChromium} from '../../../../_shared/browser/runtime.mjs';
import {check} from './check.mjs';
try {await runBrowserCheck(tabsCommand(),check,loadChromium);}
catch(error){console.error(error.message);process.exitCode=1;}
