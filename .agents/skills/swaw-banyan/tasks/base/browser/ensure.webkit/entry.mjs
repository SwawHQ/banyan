import {parseArguments,helpFor} from '../../../_shared/arguments.mjs';
import {ensureWebkit} from '../prepare.mjs';

const spec = {command:'base/browser/ensure.webkit',options:[]};
try {
  const options = parseArguments(spec,process.argv.slice(2));
  if (options === null) console.log(helpFor(spec));
  else await ensureWebkit();
} catch (error) { console.error(error.message); process.exitCode = 1; }
