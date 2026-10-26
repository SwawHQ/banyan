import path from 'node:path';
import fs from 'node:fs';
import {hugoEnvironment} from '../../.agents/skills/swaw-banyan/tasks/base/hugo/run.mjs';
import {readRelease} from '../../.agents/skills/swaw-banyan/tasks/doctor/banyan.mjs';
import {resolveBinding} from '../../.agents/skills/swaw-banyan/tasks/_shared/tools/bindings.mjs';
import {loadDependency} from '../../.agents/skills/swaw-banyan/tasks/_shared/dependencies.mjs';

export const fixtureTools=()=>Object.fromEntries(['git','go','hugo'].map(name=>[name,{...resolveBinding(name),source:'path'}]));
export const fixtureI18nMount='\n[[module.mounts]]\nsource = "assets/i18n"\ntarget = "i18n"\n';
export function fixtureSiteFiles(directory) {
  fs.cpSync(new URL('../../assets/i18n/',import.meta.url),path.join(directory,'assets/i18n'),{recursive:true});
  const siteAssets=path.join(directory,'assets/site');
  fs.mkdirSync(siteAssets,{recursive:true});
  for(const file of ['icons.toml','delivery.toml','favicon.ico','favicon.link.svg','icon-180.png','icon-192.png','icon-256.png','icon-512.png','manifest.webmanifest.tmpl','robots.txt.tmpl'])
    fs.copyFileSync(new URL('../../assets/site/'+file,import.meta.url),path.join(siteAssets,file));
}

export function fixtureSitePages(directory,names) {
  for(const name of names)
    fs.cpSync(new URL('../../content/'+name+'/',import.meta.url),path.join(directory,'content',name),{recursive:true});
}

export function fixtureDelivery(...tables) {
  const toml=loadDependency('@iarna/toml');
  return toml.stringify(Object.assign(toml.parse(fs.readFileSync(new URL('../../assets/site/delivery.toml',import.meta.url),'utf8')),
    ...tables.map(table=>toml.parse(table??''))));
}

export function fixturePairing(directory) {
  const file=path.join(directory,'hugo.toml'),theme=path.join(directory,'themes/banyan');
  fs.mkdirSync(theme,{recursive:true});
  fs.writeFileSync(file,'theme="banyan"\n'+(fs.existsSync(file)?fs.readFileSync(file,'utf8'):''));
  fs.writeFileSync(path.join(theme,'theme.toml'),'name="banyan"\nversion='+JSON.stringify(readRelease().version)+'\n');
}

export function fixtureEnvironment(work) {
  return hugoEnvironment({...process.env,
    HUGO_CACHEDIR:path.join(work,'cache'),
    HUGO_RESOURCEDIR:path.join(work,'resources'),
    GIT_OPTIONAL_LOCKS:'0'
  });
}

export function serviceWorkerPolicy(mode,contentCheckInterval=5,offlineNoticePath='_res/offline/') {
  return '[sw]\nmode = '+JSON.stringify(mode)+'\ncontent_check_interval = '+contentCheckInterval+
    '\noffline_notice_path = '+JSON.stringify(offlineNoticePath)+'\n';
}

export function directoryPage(title,fields='',params='') {
  return '---\ntitle: '+title+'\nlayout: page-collection-directory\n'+fields+
    '\nparams:\n  slots: [breadcrumb]\n'+params.replace(/^/gm,'  ')+
    '\ncascade:\n  - target: {kind: page}\n    layout: page-article-rss\n    params:\n      slots: [breadcrumb, meta]\n  - target: {kind: section}\n    layout: page-collection-directory\n    params:\n      slots: [breadcrumb]\n---\n';
}

export function fixtureContentDirectory(content) {
  for(const suffix of ['','.zh','.zh-tw']) {
    fs.mkdirSync(path.join(content,'d'),{recursive:true});
    fs.writeFileSync(path.join(content,'d','_index'+suffix+'.md'),directoryPage('Content'));
    const all=path.join(content,'all','index'+suffix+'.md');
    fs.mkdirSync(path.dirname(all),{recursive:true});
    fs.writeFileSync(all,'---\ntitle: Discover - All\nurl: all/\nlayout: page-collection-directory-all\nparams:\n  aggregate: /d\n  slots: [ breadcrumb ]\n---\n');
  }
}
