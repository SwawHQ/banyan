import {parseDirectory} from '../../_shared/cli.mjs';
import {verifyCspOutput} from './verify.mjs';

try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) {
    console.log('swban check/csp [dir]  #Check inline hashes and generated CSP; default: public');
  } else {
    console.log('CSP verified: ' + JSON.stringify(verifyCspOutput(directory)));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
