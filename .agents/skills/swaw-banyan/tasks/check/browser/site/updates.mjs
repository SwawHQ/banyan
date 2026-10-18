import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {toolExecutable} from '../../../_shared/tools/operations.mjs';
import {hugoEnvironment,prepareHugo} from '../../../base/hugo/run.mjs';
import {builds} from '../pwa/_shared/update.mjs';

// Hugo uses normal source config; a temporary probe also exercises program activation.
export async function buildNext(site,old,work) {
  const next=path.join(work,'next'),timestamp=new Date();
  const version=()=> 'v'+timestamp.toISOString().replace(/\D/g,'').slice(0,14);
  const oldVersion=JSON.parse(await fs.readFile(path.join(old,'sw-version.json'),'utf8')).version;
  while(oldVersion===version())timestamp.setUTCSeconds(timestamp.getUTCSeconds()+1);
  await prepareHugo();
  const env=hugoEnvironment({...process.env,HUGO_CACHEDIR:path.join(work,'cache'),HUGO_RESOURCEDIR:path.join(work,'resources'),
    HUGO_PARAMS_BUILD_VERSION:version(),GIT_OPTIONAL_LOCKS:'0'});
  await new Promise((resolve,reject)=>{
    const child=spawn(toolExecutable('hugo'),['--minify','--environment','production','--noBuildLock','--destination',next],
      {cwd:path.resolve(site),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let log='';
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log=(log+chunk).slice(-65536);});
    const timer=setTimeout(()=>child.kill(),120000);
    child.on('error',error=>{clearTimeout(timer);reject(new Error('Temporary Hugo build failed: '+error.message));});
    child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('Temporary Hugo build failed: '+log.trim()));});
  });
  // Content releases leave sw.js unchanged, so the check needs an explicit program revision.
  await fs.appendFile(path.join(next,'sw.js'),'\n// swban program-update probe: '+version()+'\n');
  await builds({dir:old,next});
  return {fromDir:old,toDir:next};
}
