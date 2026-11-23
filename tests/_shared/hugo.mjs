import path from 'node:path';
import fs from 'node:fs';
import {hugoEnvironment} from '../../.agents/skills/swaw-banyan/tasks/base/hugo/run.mjs';
import {readRelease} from '../../.agents/skills/swaw-banyan/tasks/_shared/banyan.mjs';
import {resolveBinding} from '../../.agents/skills/swaw-banyan/tasks/_shared/tools/bindings.mjs';
import {loadDependency} from '../../.agents/skills/swaw-banyan/tasks/_shared/dependencies.mjs';

export const fixtureTools=()=>Object.fromEntries(['git','go','hugo'].map(name=>[name,{...resolveBinding(name),source:'path'}]));
export const fixtureSiteMounts='\n[[module.mounts]]\nsource = "assets"\ntarget = "assets"\n'+
  '[[module.mounts]]\nsource = "layouts"\ntarget = "layouts"\n';
export function fixtureSiteFiles(directory) {
  fs.cpSync(new URL('../../i18n/',import.meta.url),path.join(directory,'i18n'),{recursive:true});
  fs.cpSync(new URL('../../content/_res/home-art/',import.meta.url),path.join(directory,'content/_res/home-art'),{recursive:true});
  fs.copyFileSync(new URL('../../content/_res/_index.md',import.meta.url),path.join(directory,'content/_res/_index.md'));
  const siteAssets=path.join(directory,'assets/site');
  fs.mkdirSync(siteAssets,{recursive:true});
  fs.cpSync(new URL('../../assets/deploy/',import.meta.url),path.join(directory,'assets/deploy'),{recursive:true});
  for(const file of ['favicon.ico','favicon.link.svg','apple-touch-icon.png','pwa-192.png','pwa-256.png','pwa-512.png'])
    fs.copyFileSync(new URL('../../assets/site/'+file,import.meta.url),path.join(siteAssets,file));
}

export function fixtureSitePages(directory,names) {
  for(const name of names)
    fs.cpSync(new URL('../../content/'+name+'/',import.meta.url),path.join(directory,'content',name),{recursive:true});
}

export function fixtureDelivery(...tables) {
  const toml=loadDependency('@iarna/toml');
  const source=file=>toml.parse(fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8'));
  const settings=source('assets/deploy/settings.toml'),policy=source('module/assets/deploy/policy.toml');
  return toml.stringify(Object.assign({...policy,platform:settings.platform,sw:{...settings.sw,...policy.sw},prefetch:{...settings.prefetch,...policy.prefetch}},
    ...tables.map(table=>toml.parse(table??''))));
}

export function writeDelivery(assets,text) {
  const toml=loadDependency('@iarna/toml');
  const {platform,redirects,sw,prefetch,...policy}=toml.parse(text);
  const settings={platform};
  for(const [key,field,values] of [["sw","mode",sw],["prefetch","enabled",prefetch]]) {
    if(!values || typeof values!=='object') {
      if(values!==undefined)policy[key]=values;
      continue;
    }
    settings[key]={};
    if(Object.hasOwn(values,field))settings[key][field]=values[field];
    policy[key]={...values};
    delete policy[key][field];
  }
  const dir=path.join(assets,"deploy");fs.mkdirSync(dir,{recursive:true});
  for(const [name,value] of Object.entries({settings,policy,redirects:redirects===undefined?{}:{redirects}}))
    fs.writeFileSync(path.join(dir,name+".toml"),toml.stringify(value));
}

export function fixturePairing(directory) {
  const file=path.join(directory,'hugo.toml'),theme=path.join(directory,'themes/banyan');
  fs.mkdirSync(theme,{recursive:true});
  fs.writeFileSync(file,'theme="banyan"\n'+(fs.existsSync(file)?fs.readFileSync(file,'utf8'):''));
  fs.writeFileSync(path.join(theme,'theme.toml'),'name="banyan"\nversion='+JSON.stringify(readRelease().version)+'\n');
}

export function previewWorkspace(source) {
  const {module,version}=readRelease();
  fs.copyFileSync(new URL('../../hugo.work',import.meta.url),path.join(source,'hugo.work'));
  fs.writeFileSync(path.join(source,'go.mod'),'module example.test/preview\n\ngo 1.18\n\nrequire '+module+' v'+version+'\n');
}

export function fixtureEnvironment(work) {
  return hugoEnvironment({...process.env,
    HUGO_CACHEDIR:path.join(work,'cache'),
    HUGO_RESOURCEDIR:path.join(work,'resources'),
    GIT_OPTIONAL_LOCKS:'0'
  });
}

export function referenceSiteEnvironment(work) {
  return {...fixtureEnvironment(work),HUGO_MODULE_WORKSPACE:'hugo.work'};
}

export function serviceWorkerPolicy(mode,contentCheckInterval=5) {
  return '[sw]\nmode = '+JSON.stringify(mode)+'\ncontent_check_interval = '+contentCheckInterval+'\n';
}

export function directoryPage(title,fields='',params='') {
  return '---\ntitle: '+title+'\nlayout: page-collection-directory\n'+fields+
    '\nparams:\n  slots: [breadcrumb]\n'+params.replace(/^/gm,'  ')+
    '\ncascade:\n  - target: {kind: page}\n    layout: page-article-rss\n    params:\n      slots: [breadcrumb, meta]\n  - target: {kind: section}\n    layout: page-collection-directory\n    params:\n      slots: [breadcrumb]\n---\n';
}

export function fixtureContentDirectory(content) {
  for(const suffix of ['','.zh','.ar']) {
    fs.mkdirSync(path.join(content,'d'),{recursive:true});
    fs.writeFileSync(path.join(content,'d','_index'+suffix+'.md'),directoryPage('Content'));
    const all=path.join(content,'all','_index'+suffix+'.md');
    fs.mkdirSync(path.dirname(all),{recursive:true});
    fs.writeFileSync(all,'---\ntitle: Discover - All\nlayout: page-collection-directory-all\nparams:\n  aggregate: /d\n  slots: [ breadcrumb ]\n---\n');
  }
}
