import path from 'node:path';
import fs from 'node:fs';
import {hugoEnvironment} from '../../.agents/skills/swaw-banyan/tasks/base/hugo/run.mjs';
import {readRelease} from '../../.agents/skills/swaw-banyan/tasks/doctor/banyan.mjs';
import {resolveBinding} from '../../.agents/skills/swaw-banyan/tasks/_shared/tools/bindings.mjs';

export const fixtureTools=()=>Object.fromEntries(['git','go','hugo'].map(name=>[name,{...resolveBinding(name),source:'path'}]));

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

export function serviceWorkerPolicy(mode,contentCheckInterval=5,offlineNoticePath='offline/') {
  return '[service_worker]\nmode = '+JSON.stringify(mode)+'\ncontent_check_interval = '+contentCheckInterval+
    '\noffline_notice_path = '+JSON.stringify(offlineNoticePath)+'\n';
}

export function directoryPage(title,fields='') {
  return '---\ntitle: '+title+'\nlayout: page-collection\nlist: directory\nslots: {breadcrumb: true}\n'+fields+
    '\ncascade:\n  - target: {kind: page}\n    layout: page-article\n    slots: {breadcrumb: true, meta: true}\n  - target: {kind: section}\n    layout: page-collection\n    slots: {breadcrumb: true}\n---\n';
}

export function fixtureContentDirectory(content) {
  for(const suffix of ['','.zh','.zh-tw']) {
    fs.mkdirSync(path.join(content,'d'),{recursive:true});
    fs.writeFileSync(path.join(content,'d','_index'+suffix+'.md'),directoryPage('Content','root_nav: false'));
    const all=path.join(content,'all','index'+suffix+'.md');
    fs.mkdirSync(path.dirname(all),{recursive:true});
    fs.writeFileSync(all,'---\ntitle: Discover - All\nurl: all/\nroot_nav: true\nlayout: page-collection\nlist: all\naggregate: /d\nslots: {breadcrumb: true}\n---\n');
  }
}
