import fs from 'node:fs';
import path from 'node:path';
import {skillRoot} from '../_shared/tools/manifest.mjs';
import {pathToFileURL} from 'node:url';

export function taskFile(command,{allowHelpTopic=false}={}) {
  const unknown = () => { throw new Error(`unknown_command:${command}`); };
  if (!command.split('/').every(part => /^[a-z_][a-z0-9_-]*(?:\.[a-z_][a-z0-9_-]*)*$/.test(part))) unknown();
  const root = path.join(skillRoot, 'tasks');
  const entry = path.join(root, ...command.split('/'), 'entry.mjs');
  const file=allowHelpTopic&&!fs.existsSync(entry)?path.join(path.dirname(entry),'help.en.txt'):entry;
  if (!fs.statSync(file,{throwIfNoEntry:false})?.isFile()) unknown();
  const relative = path.relative(fs.realpathSync(root), fs.realpathSync(file));
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) unknown();
  return file;
}

export async function runTask(command,args) {
  const entry=taskFile(command);
  process.argv=[process.execPath,entry,...args];
  await import(pathToFileURL(entry).href);
  return process.exitCode??0;
}
