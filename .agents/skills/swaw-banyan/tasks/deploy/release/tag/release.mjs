import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {moduleFromGraph,parseRelease,versionPattern} from '../../../_shared/banyan.mjs';
import {parseToml} from '../../../_shared/parsers.mjs';
import {toolExecutable} from '../../../_shared/tools/operations.mjs';
import {workspaceEnvironment} from '../../../dev/workspace.mjs';
import {hugoEnvironment} from '../../../base/hugo/run.mjs';

const skillFile='.agents/skills/swaw-banyan/SKILL.md',themeFile='module/theme.toml';
const buildEntry=fileURLToPath(new URL('../../../build/entry.mjs',import.meta.url));

export function release({version,stage,check=false,cwd=process.cwd()}) {
  if (!versionPattern.test(version)) throw new Error('Use a SemVer version without v.');
  const env={...hugoEnvironment(),GOWORK:'off',GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1',
    GIT_GRAFT_FILE:process.platform==='win32'?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never',LC_ALL:'C'};
  function run(exe,args,dir=cwd,environment=env) {
    const result=spawnSync(exe,args,{cwd:dir,env:environment,encoding:'utf8',windowsHide:true,timeout:600000,maxBuffer:16*1024*1024});
    if (result.error) throw result.error;
    if (result.status!==0) throw new Error(result.stderr.trim()||result.stdout.trim()||'Command failed: '+args[0]);
    return result.stdout.trimEnd();
  }
  const git=(args,dir)=>run(toolExecutable('git'),args,dir);
  cwd=git(['rev-parse','--show-toplevel']);
  const branch=git(['symbolic-ref','HEAD']);
  let head=git(['rev-parse','HEAD']);
  function cleanHead() {
    if (git(['symbolic-ref','HEAD'])!==branch || git(['rev-parse','HEAD'])!==head ||
        git(['status','--porcelain','--untracked-files=all'])) throw new Error('Release requires a clean working tree on the original branch and commit.');
  }
  cleanHead();
  const urls=git(['remote','get-url','--push','--all','origin']).split(/\r?\n/);
  if (urls.length!==1) throw new Error('origin must have exactly one push URL.');
  const query=git(['remote','get-url','origin'])===urls[0]?['ls-remote','--symref','origin']:
    ['-c','url.'+urls[0]+'.insteadOf=swban-release-probe:','ls-remote','--symref','swban-release-probe:'];
  const tag='v'+version,moduleTag='module/'+tag;
  const ref=name=>'refs/tags/'+name;
  const targets=[branch,ref(moduleTag),ref(tag)];
  const rows=git([...query,'HEAD',...targets]).split(/\r?\n/);
  if (!rows.includes('ref: '+branch+'\tHEAD')) throw new Error('Check out the default branch of the origin push destination.');
  const refs=new Map(rows.map(line=>line.split('\t').reverse()));
  if (!refs.has(branch)) throw new Error('Publish the release branch to origin first.');
  git(['merge-base','--is-ancestor',refs.get(branch),head]);
  const moduleCommit=refs.get(ref(moduleTag));
  if (stage==='project' && !moduleCommit) throw new Error('Publish '+moduleTag+' before the project tag.');
  if (stage==='module' && moduleCommit) throw new Error(moduleTag+' is already published.');
  if (refs.has(ref(tag))) throw new Error(tag+' is already published.');
  for (const name of [moduleTag,tag]) {
    const local=git(['tag','--list',name]);
    if (local && git(['rev-parse',ref(name)])!==refs.get(ref(name))) throw new Error('Conflicting local tag: '+name);
  }
  const read=file=>fs.readFileSync(path.join(cwd,file),'utf8');
  const skill=read(skillFile),theme=read(themeFile);
  const current=parseRelease(skill),themeMeta=parseToml(theme);
  if (themeMeta.name!=='banyan') throw new Error('Expected the Banyan theme.');
  const updatedSkill=skill.replace(/^(\uFEFF?---\r?\n(?:(?!^---)[\s\S])*?^metadata:[^\S\r\n]*\r?\n(?:(?:[ \t]+[^\r\n]*|)[\r]?\n)*?[ \t]+version:[ \t]*)(?:"[^"]*"|'[^']*'|[^\s#]+)/m,(_,prefix)=>prefix+JSON.stringify(version));
  const updatedTheme=theme.replace(/^(version[ \t]*=[ \t]*)(?:"[^"]*"|'[^']*')/m,(_,prefix)=>prefix+JSON.stringify(version));
  if (parseRelease(updatedSkill).version!==version || parseToml(updatedTheme).version!==version)
    throw new Error('Could not update the Skill and Theme versions.');
  const go=(args,dir,environment)=>run(toolExecutable('go'),args,dir,environment);
  const module=current.module;
  if (JSON.parse(go(['mod','edit','-json','module/go.mod'])).Module.Path!==module ||
      (+version.split('.')[0]>=2 && !module.endsWith('/v'+version.split('.')[0]))) throw new Error('Module path does not match the release version or Skill.');
  if (moduleCommit) {
    git(['merge-base','--is-ancestor',moduleCommit,head]);
    if (current.version!==version || themeMeta.version!==version ||
        git(['rev-parse',moduleCommit+':module'])!==git(['rev-parse',head+':module']))
      throw new Error(moduleTag+' already exists with different source. Release the theme fix under a new version.');
  }
  const tags=[...(!moduleCommit?[moduleTag]:[]),...(stage!=='module'?[tag]:[])];
  const files=[...(!moduleCommit?[skillFile,themeFile]:[]),...(stage!=='module'?['go.mod','go.sum']:[])];
  const plan={version,head,branch:branch.slice(11),remote:'origin',tags,files,resume:!!moduleCommit};
  const push=['-c','remote.origin.mirror=false','push','--atomic','--no-follow-tags','--recurse-submodules=no'];
  git([...push,'--dry-run','--no-verify','origin',head+':'+branch,...tags.map(name=>head+':'+ref(name))]);
  if (check) return {...plan,published:false};

  const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw','banyan','release-tag');
  fs.mkdirSync(parent,{recursive:true});
  const temp=fs.mkdtempSync(path.join(parent,'publish-')),site=path.join(temp,'site');
  let attached=false;
  const inSite=args=>git(args,site);
  function commitFiles(paths,message) {
    inSite(['add','--',...paths]);
    if (inSite(['diff','--cached','--name-only'])) inSite(['commit','-m',message]);
  }
  function publish(name) {
    cleanHead();
    if (git(['remote','get-url','--push','--all','origin'])!==urls[0]) throw new Error('The origin push destination changed during release.');
    const next=inSite(['rev-parse','HEAD']);
    git(['merge','--ff-only','--no-overwrite-ignore',next]);
    head=next;
    cleanHead();
    git([...push,'origin',next+':'+branch,next+':'+ref(name)]);
  }
  function build(environment,output) {
    run(process.execPath,[buildEntry,'--destination',path.join(temp,output)],site,environment);
  }
  try {
    git(['worktree','add','--detach',site,head]);attached=true;
    const releaseEnv={...env,HUGO_MODULE_WORKSPACE:'off',HUGO_ENVIRONMENT:'production',
      HUGO_CACHEDIR:path.join(temp,'hugo'),GOMODCACHE:path.join(temp,'modules'),GOFLAGS:'-modcacherw'};
    if (!moduleCommit) {
      fs.writeFileSync(path.join(site,skillFile),updatedSkill);
      fs.writeFileSync(path.join(site,themeFile),updatedTheme);
      commitFiles([skillFile,themeFile],'Release Module '+tag);
      build({...releaseEnv,...workspaceEnvironment,HUGO_CACHEDIR:path.join(temp,'local-hugo')},'local-public');
      publish(moduleTag);
      if (stage==='module') return {...plan,commit:head,published:true};
    }
    const root=JSON.parse(go(['mod','edit','-json'],site,releaseEnv));
    const drops=(root.Replace||[]).filter(r=>r.Old.Path===module).map(r=>'-dropreplace='+module+(r.Old.Version?'@'+r.Old.Version:''));
    go(['mod','edit',...drops,'-require='+module+'@'+tag],site,releaseEnv);
    const download=['mod','download','-json',module+'@'+tag];
    const downloaded=JSON.parse(go(download,site,releaseEnv));
    // A proxy may omit VCS metadata. Verify its checksums against the canonical Git tag.
    const direct=releaseEnv.GOPROXY==='direct'?downloaded:JSON.parse(go(download,site,{
      ...releaseEnv,GOPROXY:'direct',GOMODCACHE:path.join(temp,'source-check')
    }));
    const expected=inSite(['rev-parse',(moduleCommit||head)+'^{commit}']);
    if (direct.Origin?.Hash!==expected || direct.Sum!==downloaded.Sum || direct.GoModSum!==downloaded.GoModSum)
      throw new Error('Downloaded '+module+'@'+tag+' does not match published '+moduleTag+' at '+expected+'.');
    const graph=run(toolExecutable('hugo'),['mod','graph'],site,releaseEnv);
    const active=moduleFromGraph(graph,module);
    if (!active || active.path!==module || active.version!==tag || active.vendored || graph.split(/\r?\n/).some(line=>line.includes(' '+module+'@') && line.includes(' => ')))
      throw new Error('Hugo must resolve '+module+'@'+tag+' directly.');
    build(releaseEnv,'release-public');
    commitFiles(['go.mod','go.sum'].filter(f=>fs.existsSync(path.join(site,f))),'Pin Banyan Module '+tag);
    publish(tag);
    return {...plan,commit:head,published:true};
  } finally {
    if (attached) git(['worktree','remove','--force',site]);
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
