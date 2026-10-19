import {parseArguments,helpFor} from '../../../../_shared/arguments.mjs';
import {prepareCli} from '../../_shared/runtime.mjs';

const spec = {command:'deploy/cloudflare/cli/ensure',options:[{name:'force'}]};
try {
  const options = parseArguments(spec,process.argv.slice(2));
  if (options === null) console.log(helpFor(spec));
  else console.log(JSON.stringify({...await prepareCli('cf',{force:options.force}),action:'prepared'}));
} catch (error) { console.error(`[swban] ${error.message}`); process.exitCode = 1; }
