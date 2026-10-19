import {parseArguments,helpFor} from '../../../../_shared/arguments.mjs';
import {prepareCli} from '../../_shared/runtime.mjs';

const spec = {command:'deploy/cloudflare/wrangler/ensure',options:[{name:'force'}]};
try {
  const options = parseArguments(spec,process.argv.slice(2));
  if (options === null) console.log(helpFor(spec));
  else console.log(JSON.stringify({...await prepareCli('wrangler',{force:options.force}),action:'prepared'}));
} catch (error) { console.error(`[swban] ${error.message}`); process.exitCode = 1; }
