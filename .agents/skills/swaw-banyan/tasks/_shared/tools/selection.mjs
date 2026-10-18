import fs from 'node:fs';
import path from 'node:path';
import {definition, toolsRoot} from './manifest.mjs';
import {stat, fail, installLock} from './filesystem.mjs';
import {probe} from './process.mjs';
import {receipt, definitionMatches} from './managed.mjs';
import {install, recover, retireBackup} from './install.mjs';
import {readBindings, resolveBinding, bindingFor, writeBindings, launcherText} from './bindings.mjs';

const compare = (left, right) => {
  const a = left.split('.').map(Number), b = right.split('.').map(Number);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  return 0;
};
export function compatible(version, rule) {
  return (!rule.exact || version === rule.exact) && (!rule.min || compare(version, rule.min) >= 0)
    && (!rule.before || compare(version, rule.before) < 0);
}
function pathCandidates(name, env = process.env) {
  const value = Object.entries(env).find(([key]) => key.toLowerCase() === 'path')?.[1] || '';
  const executable = name + (process.platform === 'win32' ? '.exe' : '');
  return [...new Set(value.split(path.delimiter).map(part => part.replace(/^"(.*)"$/, '$1')).filter(path.isAbsolute)
    .map(directory => path.join(directory, executable)).filter(file => fs.existsSync(file) && fs.statSync(file).isFile()))];
}
export async function inspect(name, executable, env = process.env) {
  const tool = definition(name);
  if (!fs.existsSync(executable) || !fs.statSync(executable).isFile()) return null;
  const clean = Object.fromEntries(Object.entries(env).filter(([key]) => !/^(GOROOT|GOTOOLCHAIN)$/i.test(key)));
  if (name === 'go') clean.GOTOOLCHAIN = 'local';
  const result = await probe(executable, [name === 'go' || name === 'hugo' ? 'version' : '--version'], {env:clean});
  const patterns = {bun:/^(\d+\.\d+\.\d+)$/,node:/^v(\d+\.\d+\.\d+)$/,
    hugo:/^hugo v(\d+\.\d+\.\d+)(?:-[a-f0-9]+)?\+extended(?:\+withdeploy)?\s/,
    go:/^go version go(\d+\.\d+\.\d+)\s/,git:/^git version (\d+\.\d+\.\d+)(?:\s|\.|$)/,
    gh:/^gh version (\d+\.\d+\.\d+)(?:\s|$)/,uv:/^uv (\d+\.\d+\.\d+)(?:\s|$)/};
  const version = result.ok && result.text.match(patterns[name])?.[1];
  if (!version || !compatible(version, tool.compatibility)) return null;
  const found = {path:fs.realpathSync(executable), version};
  if (name === 'node') {
    const directory = path.dirname(found.path);
    const candidates = [path.join(directory,'node_modules/npm/bin'),path.join(directory,'../node_modules/npm/bin')];
    for (const part of (Object.entries(env).find(([key]) => key.toLowerCase() === 'path')?.[1] || '').split(path.delimiter)) {
      if (path.isAbsolute(part) && fs.existsSync(path.join(part,'npm.cmd'))) candidates.push(path.join(part,'node_modules/npm/bin'));
    }
    found.npmDirectory = candidates.find(dir => ['npm-cli.js','npx-cli.js'].every(file => fs.existsSync(path.join(dir,file)) && fs.statSync(path.join(dir,file)).isFile()));
    if (found.npmDirectory) found.npmDirectory = fs.realpathSync(found.npmDirectory);
    else delete found.npmDirectory;
  }
  if (name === 'go') {
    const sdk = await probe(found.path, ['env','GOROOT'], {env:clean});
    if (!sdk.ok || !path.isAbsolute(sdk.text) || !tool.requiredFiles.every(file => fs.existsSync(path.join(sdk.text,file)) && fs.statSync(path.join(sdk.text,file)).isFile())) return null;
    found.root = fs.realpathSync(sdk.text);
  }
  return found;
}
async function selected(name, record, root, env) {
  if (!record.tools[name]) return null;
  let binding;
  try { binding = resolveBinding(name, record, root); } catch { return null; }
  if (binding.source === 'managed' && !await definitionMatches(path.join(root,name), definition(name), receipt(path.join(root,name),definition(name)))) return null;
  const inspected = await inspect(name, binding.path, env);
  if (inspected && name === 'node' && binding.npmDirectory &&
      ['npm-cli.js','npx-cli.js'].every(file => fs.existsSync(path.join(binding.npmDirectory,file)) && fs.statSync(path.join(binding.npmDirectory,file)).isFile())) {
    inspected.npmDirectory = binding.npmDirectory;
  }
  return inspected && bindingFor(name, inspected, binding.source, root);
}
async function discover(name, root, env) {
  const tool = definition(name), managed = path.join(root,name);
  if (stat(managed) && await definitionMatches(managed,tool,receipt(managed,tool))) {
    const found = await inspect(name,path.join(managed,tool.executable),env);
    if (found) return bindingFor(name,found,'managed',root);
  }
  for (const executable of pathCandidates(name,env)) {
    // A damaged managed copy is never reclassified as an external installation.
    const relative = path.relative(managed,fs.realpathSync(executable));
    if (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep)) continue;
    const found = await inspect(name,executable,env);
    if (found) return bindingFor(name,found,'path',root);
  }
  return null;
}
async function prepared(name, record, root, env, {force = false, archivePath, receive} = {}) {
  const tool = definition(name);
  recover(root,tool);
  if (!force) {
    const existing = await selected(name,record,root,env) || await discover(name,root,env);
    if (existing) return {binding:existing,action:'reused'};
  }
  const action = await install(root,tool,{force,archivePath:name === 'node' ? archivePath : undefined,receive});
  const found = await inspect(name,path.join(root,name,tool.executable),env);
  if (!found) fail('installed_tool_incomplete:' + name);
  retireBackup(root,tool);
  return {binding:bindingFor(name,found,'managed',root),action};
}
export async function prepareTool(name, args, {root = toolsRoot, env = process.env, archivePath, receive} = {}) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--force')) fail('invalid_ensure_arguments');
  const unlock = installLock(root);
  try {
    const record = readBindings(root), result = await prepared(name,record,root,env,{force:args.length === 1,archivePath,receive});
    record.tools[name] = result.binding;
    writeBindings(record,root);
    return {tool:name,...resolveBinding(name,record,root),action:result.action};
  } finally { unlock(); }
}
export async function prepareTools(names, options = {}) {
  const record = readBindings(options.root);
  for (const name of names) if (!record.tools[name]) await prepareTool(name,[],options);
}
export async function prepareRuntime(args = [], {root = toolsRoot, env = process.env, archivePath, receive} = {}) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--force')) fail('invalid_ensure_arguments');
  const unlock = installLock(root);
  try {
    const record = readBindings(root);
    const result = await prepared('node',record,root,env,{force:args.length === 1,archivePath,receive});
    record.tools.node = result.binding; record.runtime = 'node';
    writeBindings(record,root);
    return {runtime:'node',...resolveBinding('node',record,root),action:result.action};
  } finally { unlock(); }
}
export async function inspectBinding(name, {root = toolsRoot, env = process.env} = {}) {
  const record = readBindings(root), bound = resolveBinding(name,record,root);
  const current = await selected(name,record,root,env);
  if (!current || current.version !== bound.version || ['path','root','npmDirectory'].some(field => current[field] !== record.tools[name][field])) {
    fail(`tool_binding_changed:${name}; run swban base/${name}/ensure`);
  }
  if (record.runtime === name && (!stat(path.join(root,'cli.cmd')) || fs.readFileSync(path.join(root,'cli.cmd'),'utf8') !== launcherText(record))) fail(`runtime_launcher_changed; run swban base/${name}/ensure`);
  return {tool:name,...bound,action:'checked'};
}
