import path from 'node:path';
import {fileURLToPath} from 'node:url';

const tasks=fileURLToPath(new URL('../',import.meta.url));

export function usageError(message) {
  // dev/build reuses build's parser. Point to the command the caller invoked.
  const entry=process.argv[1];
  if (entry && path.basename(entry)==='entry.mjs') {
    const command=path.relative(tasks,path.dirname(entry)).split(path.sep).join('/');
    if (command && !command.startsWith('.') && !path.isAbsolute(command))
      return new Error(`${message}\nSee swban ${command}/help`);
  }
  return new Error(message);
}
