import {parseArguments,helpFor} from '../../_shared/arguments.mjs';
import {ensureWebkit} from '../../_shared/browser/prepare.mjs';

const spec = {command:'ensure/browser.webkit',options:[],description:'Install the locked Playwright dependency and its WebKit browser inside this Skill.',examples:['ensure/browser.webkit']};
try {
  const options = parseArguments(spec,process.argv.slice(2));
  if (options === null) console.log(helpFor(spec));
  else await ensureWebkit();
} catch (error) { console.error(error.message); process.exitCode = 1; }
