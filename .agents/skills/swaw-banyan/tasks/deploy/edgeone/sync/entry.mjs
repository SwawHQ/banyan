import {helpFor} from '../../../_shared/arguments.mjs';
import {parseDirectory} from '../../../_shared/cli.mjs';
import {syncEdgeone} from './sync.mjs';

try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) {
    console.log(helpFor({command:'deploy/edgeone/sync'}));
  } else {
    await syncEdgeone(directory);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
