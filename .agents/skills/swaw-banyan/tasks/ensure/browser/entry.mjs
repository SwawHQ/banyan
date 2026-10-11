import {parseArguments,helpFor} from '../../_shared/arguments.mjs';
import {ensureChromium} from '../../_shared/browser/prepare.mjs';

const spec = {command:'ensure/browser',options:[],description:'Install the locked Playwright dependency and its Chromium browser inside this Skill.',examples:['ensure/browser']};
try {
  const options = parseArguments(spec,process.argv.slice(2));
  if (options === null) console.log(helpFor(spec));
  else await ensureChromium();
} catch (error) { console.error(error.message); process.exitCode = 1; }
