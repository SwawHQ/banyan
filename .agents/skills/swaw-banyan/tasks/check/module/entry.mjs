import {parseDirectory,printCheck} from '../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';

try {
  const site = parseDirectory(process.argv.slice(2),{defaultDirectory:'.',kind:'site'});
  if (site === null) console.log('swban check/module [site]  #Check Skill/Module versions; default: current site');
  else {
    const result = inspect(site);
    console.log(`Skill: ${result.release.version}; expected Module: ${result.release.module}@v${result.release.version}`);
    if (result.module) console.log(`Module: ${result.module.directory || result.module.path+'@'+(result.module.version || '(no version)')}${result.module.vendored ? ' (vendor)' : ''}`);
    console.log(`Pairing: ${result.state}${result.state === 'development' ? ' (same checkout; not a release version match)' : ''}`);
    printCheck('check/module',result);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
