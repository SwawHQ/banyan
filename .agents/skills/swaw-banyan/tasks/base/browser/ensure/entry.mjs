import {parseArguments} from '../../../_shared/arguments.mjs';
import {ensureChromium} from '../prepare.mjs';

const spec = {command:'base/browser/ensure',options:[]};
try {
  parseArguments(spec,process.argv.slice(2));
  await ensureChromium();
} catch (error) { console.error(error.message); process.exitCode = 1; }
