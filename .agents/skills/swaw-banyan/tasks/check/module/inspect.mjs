import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parse} from '../../_shared/_vendor/yaml.mjs';
import {toolExecutable} from '../../../scripts.js/_toolchain/operations.mjs';
import {hugoEnvironment} from '../../../scripts.js/hugo/index.mjs';

const skillRoot = fileURLToPath(new URL('../../../',import.meta.url));
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$/;

export function readRelease(root = skillRoot) {
  const text = fs.readFileSync(path.join(root,'SKILL.md'),'utf8');
  const front = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const metadata = front && parse(front[1])?.metadata;
  if (!metadata || typeof metadata.version !== 'string' || !versionPattern.test(metadata.version)
      || typeof metadata.module !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._~/-]*\/module$/.test(metadata.module)) {
    throw new Error('SKILL.md requires metadata.version (SemVer without v) and metadata.module (module path).');
  }
  return {version:metadata.version,module:metadata.module};
}

// Hugo's graph includes the effective vendor version and optional replacement.
// Keep the replacement intact: a local directory may contain spaces or an @.
export function moduleFromGraph(graph,modulePath) {
  const matches = [];
  for (const line of graph.split(/\r?\n/)) {
    const edge = line.trim().match(/^\S+\s+(\S+)(?:\s+=>\s+(.+))?$/);
    if (!edge) continue;
    const [dependency,replacement] = edge.slice(1);
    const separator = dependency.indexOf('@');
    const name = separator < 0 ? dependency : dependency.slice(0,separator);
    if (name !== modulePath) continue;
    let version = separator < 0 ? '' : dependency.slice(separator+1);
    const vendored = version.endsWith('+vendor');
    if (vendored) version = version.slice(0,-7);
    if (replacement) {
      const local = path.isAbsolute(replacement) || path.win32.isAbsolute(replacement);
      const remote = !local && replacement.match(/^([^\s@]+)@(v\S+)$/);
      if (remote) matches.push({path:remote[1],version:remote[2],vendored});
      else matches.push({path:name,version:'',directory:replacement,vendored});
    } else matches.push({path:name,version,vendored});
  }
  const distinct = [...new Map(matches.map(item => [JSON.stringify(item),item])).values()];
  if (distinct.length > 1) throw new Error('Hugo resolved multiple Banyan dependencies; cannot establish one version pair.');
  return distinct[0] ?? null;
}

function sameCheckout(directory,root,site) {
  const actualSkill = fs.realpathSync(root);
  const repository = path.resolve(actualSkill,'../../..');
  if (!fs.existsSync(path.join(repository,'.git'))
      || path.join(repository,'.agents','skills','swaw-banyan') !== actualSkill) return false;
  try {
    return fs.realpathSync(path.resolve(site,directory)) === fs.realpathSync(path.join(repository,'module'));
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export function assess(module,release,{root = skillRoot,site = process.cwd()} = {}) {
  const expected = 'v'+release.version;
  if (!module) return {state:'missing',issues:[`Banyan Module not found in Hugo's dependency graph. Configure ${release.module}@${expected} for this Skill.`]};
  if (module.directory) {
    const local = sameCheckout(module.directory,root,site);
    return {state:local ? 'development' : 'unverified',issues:local ? [] : [
      `Local Module ${module.directory} is outside this Skill's Banyan checkout; version pairing is unverified.`
    ]};
  }
  const matched = module.path === release.module && module.version === expected;
  return {state:matched ? 'matched' : 'mismatch',issues:matched ? [] : [
    `Skill ${release.version} requires ${release.module}@${expected}; Hugo resolves ${module.path}@${module.version || '(no version)'}. Choose a matching Skill or an authorized Module upgrade before version-specific changes.`
  ]};
}

export function inspect(site = process.cwd()) {
  const release = readRelease();
  const result = spawnSync(toolExecutable('hugo'),['mod','graph','--noBuildLock'],{
    cwd:path.resolve(site),env:hugoEnvironment(),shell:false,encoding:'utf8',
    timeout:60000,maxBuffer:8*1024*1024,windowsHide:true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || 'Hugo module resolution failed.');
  const module = moduleFromGraph(result.stdout,release.module);
  return {release,module,...assess(module,release,{site})};
}
