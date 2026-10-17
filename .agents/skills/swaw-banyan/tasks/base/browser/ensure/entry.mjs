import {parseArguments,helpFor} from '../../../_shared/arguments.mjs';
import {ensureChromium} from '../prepare.mjs';

const spec = {command:'base/browser/ensure',options:[]};
try {
  const options = parseArguments(spec,process.argv.slice(2));
  if (options === null) console.log(helpFor(spec));
  else await ensureChromium();
} catch (error) { console.error(error.message); process.exitCode = 1; }
