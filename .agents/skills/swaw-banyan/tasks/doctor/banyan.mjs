import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parse} from '../_shared/_vendor/yaml.mjs';
import {parse as parseToml} from '../_shared/_vendor/toml.mjs';
import {toolExecutable} from '../_shared/toolchain/operations.mjs';
import {hugoEnvironment} from '../base/hugo/run.mjs';

const skillRoot = fileURLToPath(new URL('../../',import.meta.url));
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

export function themesFromMounts(output,modulePath) {
  // Hugo prints one indented JSON object per component, without an outer array.
  const components = JSON.parse('['+output.trim().replace(/^}\s*(?=\{)/gm,'},\n')+']');
  const themes = [];
  for (const component of components) {
    if (!component.owner || component.path === modulePath || component.version) continue;
    const directory = fs.realpathSync(component.dir), file = path.join(directory,'theme.toml');
    const metadata = fs.existsSync(file) ? parseToml(fs.readFileSync(file,'utf8')) : {};
    if (component.path !== 'banyan' && metadata.name !== 'banyan') continue;
    if (metadata.version !== undefined && (typeof metadata.version !== 'string' || !versionPattern.test(metadata.version))) {
      throw new Error('Invalid Banyan theme version in '+file);
    }
    const version = metadata.name === 'banyan' && metadata.version ? 'v'+metadata.version : '';
    themes.push({path:modulePath,directory,version,kind:'theme'});
  }
  return themes;
}

function sharedSourceRoot(directory,root,site) {
  const actualSkill = fs.realpathSync(root);
  const repository = path.resolve(actualSkill,'../../..');
  if (path.join(repository,'.agents','skills','swaw-banyan') !== actualSkill) return null;
  try {
    return fs.realpathSync(path.resolve(site,directory)) === fs.realpathSync(path.join(repository,'module')) ? repository : null;
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}


export function assess(module,release,{root = skillRoot,site = process.cwd()} = {}) {
  const expected = 'v'+release.version;
  if (!module) return {state:'missing',issues:[`Banyan is not active in Hugo's dependency graph.`]};
  if (module.directory) {
    const repository = sharedSourceRoot(module.directory,root,site);
    if (repository && fs.existsSync(path.join(repository,'.git'))) return {state:'development',issues:[]};
    if (repository) {
      const file = path.join(repository,'module','theme.toml');
      const metadata = fs.existsSync(file) ? parseToml(fs.readFileSync(file,'utf8')) : {};
      module = {...module,version:metadata.name === 'banyan' && typeof metadata.version === 'string' && versionPattern.test(metadata.version) ? 'v'+metadata.version : ''};
    }
    if ((!repository && module.kind !== 'theme') || !module.version) return {state:'unverified',issues:[
      (module.kind === 'theme'
        ? `Banyan theme name and version could not be verified from ${path.join(module.directory,'theme.toml')}.`
        : repository
          ? `Banyan source name and version could not be verified from ${path.join(repository,'module','theme.toml')}.`
          : `Local Module ${module.directory} is outside this Skill's Banyan checkout; version pairing is unverified.`)
    ]};
  }
  const matched = module.path === release.module && module.version === expected;
  return {state:matched ? 'matched' : 'mismatch',issues:matched ? [] : [
    `Skill ${release.version} requires Banyan ${expected}; Hugo resolves ${module.path}@${module.version || '(no version)'}.`
  ]};
}

export function inspect(site = process.cwd()) {
  const release = readRelease();
  function hugo(args) {
    const result = spawnSync(toolExecutable('hugo'),[...args,'--noBuildLock'],{
      cwd:path.resolve(site),env:hugoEnvironment(),shell:false,encoding:'utf8',
      timeout:60000,maxBuffer:8*1024*1024,windowsHide:true
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || 'Hugo dependency resolution failed.');
    return result.stdout;
  }
  const resolved = moduleFromGraph(hugo(['mod','graph']),release.module);
  const themes = themesFromMounts(hugo(['config','mounts']),release.module);
  if (resolved && themes.length || themes.length > 1) throw new Error('Hugo resolved multiple Banyan themes; cannot establish one version pair.');
  const module = resolved ?? themes[0] ?? null;
  return {release,module,...assess(module,release,{site})};
}
