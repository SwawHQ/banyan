import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {skillRoot,toolsRoot} from './tools/manifest.mjs';
import {installLock,plainPath} from './tools/filesystem.mjs';
import {resolveBinding} from './tools/bindings.mjs';
import {prepareTools} from './tools/selection.mjs';
import {execute,withPath} from './tools/process.mjs';

const require = createRequire(import.meta.url);
const markerName = '.swban-packages.json';
const loaded = new Map();
function project(root) {
  const manifest = fs.readFileSync(path.join(root,'package.json'));
  const lock = fs.readFileSync(path.join(root,'package-lock.json'));
  const dependencies = JSON.parse(manifest).dependencies;
  const packages = JSON.parse(lock).packages;
  if (!dependencies || !packages || Object.entries(dependencies).some(([name,version]) =>
      !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version) || packages['']?.dependencies?.[name] !== version || packages['node_modules/'+name]?.version !== version)) {
    throw new Error('Dependency manifest and package-lock.json must pin the same versions.');
  }
  return {dependencies,fingerprint:createHash('sha256').update(manifest).update(lock).digest('hex')};
}
function installed(root,dependencies) {
  return Object.entries(dependencies).flatMap(([name,version]) => {
    try {
      const file = plainPath(path.join(root,'node_modules',name,'package.json'));
      const metadata = JSON.parse(fs.readFileSync(file,'utf8'));
      if (metadata.version !== version) return [name+': version differs'];
      if (metadata.main && !fs.existsSync(plainPath(path.resolve(path.dirname(file),metadata.main)))) return [name+': entry is missing'];
      return [];
    } catch (error) {
      if (error.code === 'ENOENT') return [name+': missing'];
      return [name+': '+error.message];
    }
  });
}
export function dependencyState(root = skillRoot) {
  const {dependencies,fingerprint} = project(root);
  const issues = installed(root,dependencies);
  if (issues.length) return {state:'missing',issues};
  try {
    const marker = JSON.parse(fs.readFileSync(plainPath(path.join(root,'node_modules',markerName)),'utf8'));
    if (marker?.fingerprint === fingerprint) return {state:'ready',issues:[]};
  } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
  return {state:'outdated',issues:['Dependency installation does not match package-lock.json.']};
}
export async function ensureDependencies(root = skillRoot,{force = false} = {}) {
  root = path.resolve(root);
  if (!force && dependencyState(root).state === 'ready') return;
  await prepareTools(['node']);
  const binding = resolveBinding('node');
  if (!binding.npmDirectory) throw new Error('npm is required; run swban base/node/ensure --force');
  const args = [path.join(binding.npmDirectory,'npm-cli.js'),'ci','--prefix='+root,'--workspaces=false','--ignore-scripts','--no-audit','--no-fund'];
  const marker = plainPath(path.join(root,'node_modules',markerName));
  const unlock = installLock(toolsRoot);
  try {
    if (!force && dependencyState(root).state === 'ready') return;
    const {dependencies,fingerprint} = project(root);
    fs.rmSync(marker,{force:true});
    console.error('[swban] Preparing packages: '+(path.relative(skillRoot,root)||'.'));
    const env = withPath([path.dirname(binding.path)],process.env);
    if (await execute(binding.path,args,{cwd:root,env,stdio:['inherit',2,2]}) !== 0) throw new Error('Dependency installation failed: '+root);
    const issues = installed(root,dependencies);
    if (issues.length) throw new Error('Dependency installation is incomplete: '+issues.join('; '));
    fs.writeFileSync(marker,JSON.stringify({fingerprint})+'\n');
    for (const name of Object.keys(dependencies)) loaded.delete(path.join(root,name));
    const directory = path.join(root,'node_modules')+path.sep;
    for (const file of Object.keys(require.cache)) if (file.startsWith(directory)) delete require.cache[file];
  } finally { unlock(); }
}
export function loadDependency(name,root = skillRoot) {
  const key = path.join(root,name);
  if (!loaded.has(key)) {
    const status = dependencyState(root);
    if (status.state !== 'ready') throw new Error('Packages '+status.state+'; run swban base/packages/ensure --force');
    if (!Object.hasOwn(project(root).dependencies,name)) throw new Error('Undeclared dependency: '+name);
    loaded.set(key,createRequire(path.join(root,'package.json'))(path.join(root,'node_modules',name)));
  }
  return loaded.get(key);
}
