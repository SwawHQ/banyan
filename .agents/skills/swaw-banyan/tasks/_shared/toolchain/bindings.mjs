import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {definition, toolsRoot} from './manifest.mjs';
import {inside, plainPath, stat, payloadName, durableWrite, fail} from './filesystem.mjs';

export function readBindings(root = toolsRoot) {
  const file = inside(root, 'bindings.json');
  if (!stat(file)) return {schema:'swaw-banyan.bindings/v1', tools:{}};
  if (!stat(file).isFile() || stat(file).size > 65536) fail('invalid_tool_bindings');
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (record.schema !== 'swaw-banyan.bindings/v1' || !record.tools || typeof record.tools !== 'object' || Array.isArray(record.tools)
      || Object.keys(record.tools).some(name => !['bun','node','hugo','go','git','gh'].includes(name))
      || (record.runtime !== undefined && !['bun','node'].includes(record.runtime))) fail('invalid_tool_bindings');
  for (const [name, tool] of Object.entries(record.tools)) {
    if (!tool || !['path','managed'].includes(tool.source) || !/^\d+\.\d+\.\d+$/.test(tool.version)
        || typeof tool.path !== 'string' || (tool.source === 'path' && !path.isAbsolute(tool.path))) fail('invalid_tool_binding:' + name);
    if (tool.source === 'managed' && tool.path !== name + '/' + definition(name).executable) fail('invalid_tool_binding:' + name);
    if (name === 'go' && !tool.root) fail('invalid_tool_binding:' + name);
    for (const field of ['root','npmDirectory']) if (tool[field] !== undefined &&
        (typeof tool[field] !== 'string' || (tool.source === 'path' ? !path.isAbsolute(tool[field]) :
          !payloadName(tool[field]) || (!tool[field].startsWith(name + '/') && tool[field] !== name)))) fail('invalid_tool_binding:' + name);
  }
  if (record.runtime && !record.tools[record.runtime]) fail(`runtime_binding_missing; run swban base/${record.runtime}/ensure`);
  return record;
}
export function resolveBinding(name, record = readBindings(), root = toolsRoot) {
  const tool = record.tools[name];
  if (!tool) fail(`tool_not_prepared:${name}; run swban base/${name}/ensure`);
  const resolved = {...tool};
  for (const field of ['path','root','npmDirectory']) if (tool[field]) {
    resolved[field] = tool.source === 'managed' ? inside(root, tool[field]) : tool[field];
  }
  if (!fs.existsSync(resolved.path) || !fs.statSync(resolved.path).isFile()) fail(`tool_binding_unusable:${name}; run swban base/${name}/ensure`);
  return resolved;
}
export function bindingFor(name, inspected, source, root = toolsRoot) {
  const tool = {...inspected, source};
  for (const field of ['path','root','npmDirectory']) if (tool[field] && source === 'managed') {
    inside(root, path.relative(root, tool[field]));
    tool[field] = path.relative(root, tool[field]).split(path.sep).join('/');
  }
  return tool;
}
function atomicWrite(file, text) {
  plainPath(file);
  if (stat(file) && !stat(file).isFile()) fail('binding_destination_occupied');
  const temporary = file + '.' + randomUUID() + '.tmp';
  durableWrite(temporary, text);
  try { fs.renameSync(temporary, file); }
  finally { if (stat(temporary)) fs.unlinkSync(temporary); }
}
export function launcherText(record) {
  const tool = record.tools[record.runtime];
  const executable = tool.source === 'managed' ? '%~dp0' + tool.path.replaceAll('/', '\\') : tool.path.replaceAll('%','%%');
  if (/["\r\n\0]/.test(executable)) fail('unsupported_runtime_path');
  return '@echo off\r\nrem swaw-banyan.cli/v1\r\nsetlocal DisableDelayedExpansion\r\n' +
    'if not exist "' + executable + '" (\r\n  echo [swban] runtime_binding_unusable; run swban base/' + record.runtime + '/ensure 1>&2\r\n  exit /b 1\r\n)\r\n' +
    '"' + executable + '" %*\r\nexit /b %ERRORLEVEL%\r\n';
}
export function writeBindings(record, root = toolsRoot) {
  fs.mkdirSync(plainPath(root), {recursive:true});
  const launcher = inside(root, 'cli.cmd');
  if (record.runtime && stat(launcher) && !fs.readFileSync(launcher, 'utf8').includes('rem swaw-banyan.cli/v1\r\n')) fail('unknown_runtime_launcher');
  atomicWrite(inside(root, 'bindings.json'), JSON.stringify(record, null, 2) + '\n');
  if (record.runtime) {
    atomicWrite(launcher, launcherText(record));
  }
}
