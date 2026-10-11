import {parseDirectory} from '../../../_shared/cli.mjs';
import {syncEdgeone} from './sync.mjs';

try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) {
    console.log('swban deploy/edgeone/sync [dir]  #Copy config to site root; default dir: public');
  } else {
    await syncEdgeone(directory);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
