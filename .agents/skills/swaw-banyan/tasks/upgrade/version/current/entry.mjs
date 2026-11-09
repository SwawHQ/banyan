import {helpFor} from '../../../_shared/arguments.mjs';
import {parseDirectory} from '../../../_shared/cli.mjs';
import {ensureDependencies} from '../../../_shared/dependencies.mjs';
import {prepareHugo} from '../../../base/hugo/run.mjs';

try {
  const site=parseDirectory(process.argv.slice(2),{defaultDirectory:'.',kind:'site'});
  if (site===null) console.log(helpFor({command:'upgrade/version/current'}));
  else {
    await ensureDependencies();
    await prepareHugo();
    const {current}=await import('./inspect.mjs');
    const result=current(site);
    console.log(JSON.stringify(result,null,2));
    process.exitCode=result.old===null?1:0;
  }
} catch(error) { console.error(error.message);process.exitCode=1; }
