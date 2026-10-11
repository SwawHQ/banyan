import fs from 'node:fs';
import path from 'node:path';
import {skillRoot} from '../_toolchain/manifest.mjs';
import {readBindings} from '../_toolchain/bindings.mjs';
import {runTool} from '../_toolchain/operations.mjs';

export function runTask(command, args) {
  const unknown = () => { throw new Error(`unknown_command:${command}; run swban help`); };
  if (!command.split('/').every(part => /^[a-z_][a-z0-9_-]*(?:\.[a-z_][a-z0-9_-]*)*$/.test(part))) unknown();
  const root = path.join(skillRoot, 'tasks');
  const entry = path.join(root, ...command.split('/'), 'entry.mjs');
  if (!fs.existsSync(entry) || !fs.statSync(entry).isFile()) unknown();
  const relative = path.relative(fs.realpathSync(root), fs.realpathSync(entry));
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) unknown();
  return runTool(readBindings().runtime, [entry, ...args]);
}
