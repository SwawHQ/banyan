import {helpFor} from '../_shared/arguments.mjs';
import {parseDirectory} from '../_shared/cli.mjs';
import {diagnose,failed} from './run.mjs';

try {
  const site=parseDirectory(process.argv.slice(2),{defaultDirectory:'.',kind:'site'});
  if (site===null) console.log(helpFor({command:'doctor'}));
  else {
    const checks=await diagnose(site);
    for (const check of checks) {
      console.log(check.id+': '+check.state+(check.detail?' ('+check.detail+')':''));
      for (const issue of check.issues??[]) console.error('  '+issue);
      if (failed(check)) console.error('  '+check.hint);
    }
    process.exitCode=checks.some(failed)?1:0;
  }
} catch(error) { console.error(error.message);process.exitCode=1; }
