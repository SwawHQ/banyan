import {helpFor,parseArguments} from '../../../_shared/arguments.mjs';
import {ensureDependencies} from '../../../_shared/dependencies.mjs';
import {prepareTools} from '../../../_shared/tools/selection.mjs';

const spec={command:'deploy/release/tag',options:[{name:'check'}]};
try {
  const args=parseArguments(spec,process.argv.slice(2));
  if (args===null) console.log(helpFor(spec));
  else {
    await ensureDependencies();
    await prepareTools(['git','go']);
    const {release}=await import('./release.mjs');
    console.log(JSON.stringify(release(args),null,2));
  }
} catch(error) { console.error(error.message);process.exitCode=1; }
