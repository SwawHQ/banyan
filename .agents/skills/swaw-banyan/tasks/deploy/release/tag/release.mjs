import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseRelease} from '../../../_shared/banyan.mjs';
import {parseToml} from '../../../_shared/parsers.mjs';
import {toolExecutable} from '../../../_shared/tools/operations.mjs';
import {gitEnvironment} from '../../../base/git/environment.mjs';
import {goEnvironment} from '../../../base/go/environment.mjs';
import {systemLanguage} from '../../../help/run.mjs';

export function release({check=false,cwd=process.cwd(),language=systemLanguage()}={}) {
  const zh=language==='zh';
  const retry=zh?'提交修改后，重试 swban deploy/release/tag --check。':'Commit the changes, then rerun swban deploy/release/tag --check.';
  const newVersion=zh
    ? '先核对该版本是否已发布；已发布则无需重复发布。发布新版时，将以下两处设为同一个未使用的版本号：\n  .agents/skills/swaw-banyan/SKILL.md: metadata.version\n  module/theme.toml: version\n'+retry
    : 'Check whether this version is already published; a published version needs no repeat publication. For a new release, set both fields to the same unused version:\n  .agents/skills/swaw-banyan/SKILL.md: metadata.version\n  module/theme.toml: version\n'+retry;
  const env={...gitEnvironment(),GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1',GIT_GRAFT_FILE:process.platform==='win32'?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never',LC_ALL:'C'};
  function git(args,{optional=false,raw=false}={}) {
    const result=spawnSync(toolExecutable('git'),args,{cwd,env,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024,windowsHide:true});
    if (result.error) throw result.error;
    if (raw) return result;
    if (result.status!==0) {
      if (optional && result.status===1) return null;
      throw new Error(result.stderr.trim()||'Git release operation failed.');
    }
    return result.stdout.trimEnd();
  }
  cwd=git(['rev-parse','--show-toplevel']);
  const commit=git(['rev-parse','--verify','HEAD^{commit}']);
  if (git(['status','--porcelain','--untracked-files=all'])) throw new Error('Commit or remove pending changes before publishing version tags.');
  const source=file=>git(['show',commit+':'+file]);
  const {version,module}=parseRelease(source('.agents/skills/swaw-banyan/SKILL.md'));
  const theme=parseToml(source('module/theme.toml'));
  if (theme.name!=='banyan') throw new Error('Committed module/theme.toml must have name = "banyan".');
  if (theme.version!==version) throw new Error([
    zh?'发布已停止：提交中的版本号不一致。':'Release stopped: committed Theme and Skill versions differ.',
    '  .agents/skills/swaw-banyan/SKILL.md: metadata.version = '+JSON.stringify(version),
    '  module/theme.toml: version = '+(JSON.stringify(theme.version)??(zh?'未设置':'missing')),
    zh?'请将这两处改为同一个待发布版本号。':'Set both fields to the same intended release version.',
    retry
  ].join('\n'));
  const temporary=path.join(fs.realpathSync(os.tmpdir()),'swaw','banyan','release-tag');
  fs.mkdirSync(temporary,{recursive:true});
  const parent=fs.realpathSync(temporary),work=fs.mkdtempSync(path.join(parent,'module-'));
  let modulePath;
  try {
    const file=path.join(work,'go.mod');
    fs.writeFileSync(file,source('module/go.mod'));
    const result=spawnSync(toolExecutable('go'),['mod','edit','-json',file],{cwd:work,env:{...goEnvironment(),GOWORK:'off'},encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024,windowsHide:true});
    if (result.error) throw result.error;
    if (result.status!==0) throw new Error(result.stderr.trim()||'Committed module/go.mod is invalid.');
    modulePath=JSON.parse(result.stdout).Module?.Path;
  } finally {
    if (path.dirname(fs.realpathSync(work))!==parent) throw new Error('Temporary Module directory escaped its parent.');
    fs.rmSync(work,{recursive:true,force:true});
  }
  if (modulePath!==module) throw new Error('Committed module/go.mod and Skill module paths must match.');
  const major=Number(version.split('.')[0]);
  if (major>=2 && !module.endsWith('/v'+major)) throw new Error('Module major version requires a matching /v'+major+' path suffix.');
  const tags=['v'+version,'module/v'+version];
  const localTags=tags.filter(tag=>git(['show-ref','--verify','--quiet','refs/tags/'+tag],{optional:true})!==null);
  if (localTags.length) throw new Error((zh?'发布已停止：本地已存在版本标签，不会覆盖：':'Release stopped: local release tags already exist and will not be overwritten:')+'\n  '+localTags.join('\n  ')+'\n'+newVersion);
  const urls=git(['remote','get-url','--push','--all','origin']).split(/\r?\n/).filter(Boolean);
  if (urls.length!==1) throw new Error('origin must have exactly one push URL.');
  const refs=tags.map(tag=>'refs/tags/'+tag);
  const rejectRemoteTags=details=>{throw new Error((zh?'发布已停止：origin 上已存在版本标签，不会覆盖：':'Release stopped: release tags already exist on origin and will not be overwritten:')+'\n'+details+'\n'+newVersion);};
  // Query through the remote name: reusing get-url's expanded URL would apply rewrites twice.
  const fetch=git(['remote','get-url','origin'],{raw:true});
  const remoteTags=fetch.status===0 && fetch.stdout.trimEnd()===urls[0]?git(['ls-remote','--tags','--','origin',...refs]):'';
  if (remoteTags) {
    const details=remoteTags.split(/\r?\n/).map(line=>{
      const [hash,ref]=line.split(/\s+/);
      return '  '+ref.replace(/^refs\/tags\//,'')+' ('+hash+')';
    }).join('\n');
    rejectRemoteTags(details);
  }
  const push=['-c','remote.origin.mirror=false','push','--porcelain','--atomic','--no-follow-tags','--recurse-submodules=no'];
  const refspecs=refs.map(ref=>commit+':'+ref);
  // A dry run follows origin's push URL, including pushInsteadOf; skip hooks for the read-only check.
  const preview=git([...push,'--dry-run','--no-verify','--','origin',...refspecs],{raw:true});
  const existing=preview.stdout.split(/\r?\n/).flatMap(line=>{
    const [flag,pair,summary]=line.split('\t'),ref=pair?.split(':')[1];
    if (!refs.includes(ref)) return [];
    if (flag.trim()==='=') return ['  '+ref.slice('refs/tags/'.length)+' ('+commit+')'];
    if (flag.trim()==='!' && /\((already exists|would clobber existing tag)\)/.test(summary)) return ['  '+ref.slice('refs/tags/'.length)];
    return [];
  });
  if (existing.length) rejectRemoteTags(existing.join('\n'));
  if (preview.status!==0) throw new Error(preview.stderr.trim()||'Git release preview failed.');
  // Push the captured commit directly so HEAD cannot move either tag between checks and publication.
  if (!check) git([...push,'--','origin',...refspecs]);
  return {version,commit,tags,remote:'origin',published:!check};
}
