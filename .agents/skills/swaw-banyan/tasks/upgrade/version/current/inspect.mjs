import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspect} from '../../../_shared/banyan.mjs';
import {parseToml} from '../../../_shared/parsers.mjs';
import {toolExecutable} from '../../../_shared/tools/operations.mjs';
import {gitEnvironment} from '../../../base/git/environment.mjs';

export function identify(module,release,{site=process.cwd()}={}) {
  if (!module) return {old:null,source:null,basis:'unknown',reason:'Banyan is not active.'};
  if (!module.directory) {
    const source=module.path+(module.version?'@'+module.version:'');
    if (module.path===release.module && module.version) {
      const version=module.version.replace(/\+incompatible$/,'');
      const old=version.match(/-\d{14}-([a-f0-9]{12})$/)?.[1]??version;
      return {old,source,basis:module.vendored?'vendor':'module'};
    }
    return {old:null,source,basis:'unknown',reason:'No official Module base is recorded.'};
  }
  const source=fs.realpathSync(path.resolve(site,module.directory));
  const file=path.join(source,'theme.toml');
  const metadata=fs.existsSync(file)?parseToml(fs.readFileSync(file,'utf8')):{};
  const candidate=metadata.name==='banyan' && typeof metadata.version==='string'?'v'+metadata.version:null;
  function git(args,optional=false) {
    const result=spawnSync(toolExecutable('git'),args,{cwd:source,env:{...gitEnvironment(),GIT_OPTIONAL_LOCKS:'0',GIT_NO_LAZY_FETCH:'1',GIT_NO_REPLACE_OBJECTS:'1',GIT_GRAFT_FILE:process.platform==='win32'?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'},encoding:'utf8',timeout:10000,maxBuffer:4*1024*1024,windowsHide:true});
    if (result.error) {
      if (optional && result.error.code==='ETIMEDOUT') return null;
      throw result.error;
    }
    if (result.status!==0) {
      if (optional && result.status!==null) return null;
      throw new Error(result.stderr.trim()||'Git inspection failed.');
    }
    return result.stdout.trim();
  }
  const unknown=reason=>({old:null,source,basis:'unknown',candidate,reason});
  const root=git(['rev-parse','--show-toplevel'],true);
  if (!root) return unknown('No Git source checkout was identified.');
  const moduleRoot=path.resolve(root,'module');
  const actual=fs.existsSync(moduleRoot)?fs.statSync(moduleRoot,{bigint:true}):null;
  const identity=fs.statSync(source,{bigint:true});
  if (!actual || actual.dev!==identity.dev || actual.ino!==identity.ino) return unknown('The active source is outside the checkout module directory.');
  const head=git(['rev-parse','--verify','HEAD'],true);
  if (!head) return unknown('The source checkout has no commit.');
  const official='https://'+release.module.replace(/\/module$/,'')+'.git';
  const refs=git(['-c','credential.interactive=false','ls-remote','--heads','--tags',official],true);
  if (refs===null) return unknown('Official refs could not be verified without fetching; check the network and repository access.');
  const tips=new Set(refs.split('\n').map(line=>line.match(/^([a-f0-9]{40}(?:[a-f0-9]{24})?)\s+refs\/(?:heads|tags)\//)?.[1]).filter(Boolean));
  let recorded=false;
  for (const tip of tips) if (git(['merge-base','--is-ancestor',head,tip],true)!==null) { recorded=true;break; }
  // A merge base can include upstream changes that a local merge deliberately omitted.
  if (!recorded) return unknown('The source commit cannot be confirmed from current official refs and locally available history.');
  const modified=Boolean(git(['status','--porcelain','--untracked-files=all','--','.']))
    || git(['diff','--quiet',head,'--','.'],true)===null;
  return {old:head,source,basis:'git',modified};
}

export function current(site=process.cwd()) {
  const {module,release}=inspect(site);
  return identify(module,release,{site});
}
