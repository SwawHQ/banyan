import {parseArguments,helpFor} from '../../../_shared/arguments.mjs';
import {ensureDependencies} from '../../../_shared/dependencies.mjs';

const spec = {command:'base/packages/ensure',options:[{name:'force'}]};
try {
  const options = parseArguments(spec,process.argv.slice(2));
  if (options === null) console.log(helpFor(spec));
  else { await ensureDependencies(undefined,{force:options.force}); console.log('Packages ready.'); }
} catch (error) { console.error(error.message); process.exitCode = 1; }
