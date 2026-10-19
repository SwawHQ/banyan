import {parseArguments,helpFor} from '../../../../_shared/arguments.mjs';
import {prepareCli} from '../runtime.mjs';

const spec = {command:'deploy/tencent/cli/ensure',options:[{name:'force'}]};
try {
  const options = parseArguments(spec,process.argv.slice(2));
  if (options === null) console.log(helpFor(spec));
  else console.log(JSON.stringify(await prepareCli({force:options.force})));
} catch (error) {console.error(`[swban] ${error.message}`);process.exitCode = 1;}
