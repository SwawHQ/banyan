import {parseArguments} from '../../../_shared/arguments.mjs';
import {ensureWebkit} from '../prepare.mjs';

const spec = {command:'base/browser/ensure.webkit',options:[]};
try {
  parseArguments(spec,process.argv.slice(2));
  await ensureWebkit();
} catch (error) { console.error(error.message); process.exitCode = 1; }
