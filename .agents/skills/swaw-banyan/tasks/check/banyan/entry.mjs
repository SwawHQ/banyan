import {helpFor} from '../../_shared/arguments.mjs';
import {parseDirectory,printCheck} from '../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';
import {prepareHugo} from '../../base/hugo/run.mjs';

try {
  const site = parseDirectory(process.argv.slice(2),{defaultDirectory:'.',kind:'site'});
  if (site === null) console.log(helpFor({command:'check/banyan'}));
  else {
    await prepareHugo();
    const result = inspect(site);
    console.log(`Skill: ${result.release.version}; expected Banyan: v${result.release.version}`);
    if (result.module) console.log(`Banyan: ${result.module.directory || result.module.path}${result.module.version ? '@'+result.module.version : ''}${result.module.vendored ? ' (vendor)' : ''}`);
    console.log(`Pairing: ${result.state}${result.state === 'development' ? ' (same checkout; not a release version match)' : ''}`);
    printCheck('check/banyan',result);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
