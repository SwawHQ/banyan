import path from 'node:path';
import fs from 'node:fs';
import {hugoEnvironment} from '../../.agents/skills/swaw-banyan/tasks/base/hugo/run.mjs';
import {readRelease} from '../../.agents/skills/swaw-banyan/tasks/doctor/banyan.mjs';
import {resolveBinding} from '../../.agents/skills/swaw-banyan/tasks/_shared/toolchain/bindings.mjs';

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
