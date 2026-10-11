import {chaptersCommand} from '../chapters/options.mjs';
import {runBrowserCheck} from '../../../../_shared/browser/run.mjs';
import {loadWebkit} from '../../../../_shared/browser/runtime.mjs';
import {check} from '../chapters/check.mjs';
const spec=chaptersCommand('check/browser/aside/chapters.webkit','Check published chapter entries, native fragments, highlight, history and no-JS links in WebKit.');
try {await runBrowserCheck(spec,check,loadWebkit);}
catch(error){console.error(error.message);process.exitCode=1;}
