import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {listenOnLoopback} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {extractStartTags,extractTagAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
for(const disableFastRender of [false,true])test('SW preview rebuilds and restores outputs with fast render '+(disableFastRender?'disabled':'enabled'),{timeout:90000},async()=>{
  const parent=path.join(fs.realpathSync.native(os.tmpdir()),'swaw/banyan/sw-assets-preview');
  fs.mkdirSync(parent,{recursive:true});const work=fs.mkdtempSync(path.join(parent,'run-')),source=path.join(work,'site');
  fs.mkdirSync(source);let server,logs='',launchError;
  try {
    for(const name of ['content','assets','module','hugo.toml','go.mod','go.sum','layouts'])
      if(fs.existsSync(path.join(root,name)))fs.cpSync(path.join(root,name),path.join(source,name),{recursive:true});
    const policyFile=path.join(source,'assets/site/delivery.toml'),originalPolicy=fs.readFileSync(policyFile,'utf8');
    const policy=(mode,interval=8)=>originalPolicy.replace(/^mode = .*$/m,'mode = "'+mode+'"').replace(/^content_check_interval = .*$/m,'content_check_interval = '+interval);
    fs.writeFileSync(policyFile,policy('enable'));
    const configFile=path.join(source,'hugo.toml'),originalConfig=fs.readFileSync(configFile,'utf8');
    const versionConfig=version=>originalConfig+'\n[params.build]\nversion = "'+version+'"\n';
    fs.writeFileSync(configFile,versionConfig('v-sw-preview-one'));
    const probe=net.createServer();await listenOnLoopback(probe);const port=probe.address().port;
    await new Promise(resolve=>probe.close(resolve));const base='http://127.0.0.1:'+port;
    // Hugo's path warning counts accumulate across full configuration reloads.
    server=spawn(toolExecutable('hugo'),['server','--noBuildLock','--enableGitInfo=false','--disableLiveReload',...(disableFastRender?['--disableFastRender']:[]),'--printPathWarnings=false',
      '--bind','127.0.0.1','--port',String(port),'--baseURL',base,'--destination',path.join(work,'preview')],
      {cwd:source,env:fixtureEnvironment(work),windowsHide:true,stdio:['ignore','pipe','pipe']});
    server.on('error',error=>{launchError=error;});server.stdout.on('data',chunk=>{logs+=chunk;});server.stderr.on('data',chunk=>{logs+=chunk;});
    const get=async route=>{const response=await fetch(base+route,{signal:AbortSignal.timeout(1500),headers:{Connection:'close'}});assert.equal(response.status,200,route);return response.text();};
    async function until(label,check) {
      const deadline=Date.now()+12000;let last;
      while(Date.now()<deadline) {
        if(launchError)throw launchError;assert.equal(server.exitCode,null,logs);
        try{if(await check()){return;}}catch(error){last=error;}
        await delay(100);
      }
      assert.fail(label+': '+last+'\n'+logs);
    }
    async function interval(expected) {
      const value=(await get('/sw.js')).match(/\bCONTENT_CHECK_INTERVAL_MS\s*=\s*([0-9.eE+-]+)/)?.[1];
      return Number(value)===expected;
    }
    async function state() {
      const [worker,policy,version]=await Promise.all(['/sw.js','/sw-policy.json','/sw-version.json'].map(get));
      return {worker,policy,version};
    }
    async function managers(mode) {
      let main='';
      for(const prefix of ['','/zh','/zh-tw','/ar']) {
        const tags=extractStartTags(await get(prefix+'/'),'script').filter(tag=>extractTagAttribute(tag,'src').includes('/js/sw-manager.'));
        assert.equal(tags.length,mode==='off'?0:1);
        if(mode!=='off') {
          const src=extractTagAttribute(tags[0],'src');assert.match(src,new RegExp('/sw-manager\\.'+mode+'\\.bundle\\.[^.]+\\.js$'));
          const code=await get(src);assert.equal(extractTagAttribute(tags[0],'integrity'),'sha256-'+createHash('sha256').update(code).digest('base64'));
          if(main)assert.equal(code,main,'All languages must load the same manager.');main=code;
        }
        assert.doesNotMatch(await get(prefix+'/_res/offline/'),/\/js\/sw-manager\./);
      }
      return main;
    }
    await until('initial enable preview and four-language manager SRI',async()=>{await managers('enable');return await interval(480000);});
    const initial=await state(),initialManager=await managers('enable');
    fs.writeFileSync(policyFile,policy('enable',11));
    await until('interval edits rebuild worker',async()=>await interval(660000));
    const configured=await state();
    fs.writeFileSync(policyFile,policy('enable'));
    await until('restored interval reproduces the original worker',async()=>{assert.deepEqual(await state(),initial);return true;});
    fs.writeFileSync(policyFile,policy('enable',11)+'\n[[routes]]\npath = "/preview-probe/*"\nsw.bucket = "off"\n');
    await until('route edits rebuild policy and worker',async()=>(await get('/sw-policy.json')).includes('/preview-probe/*')&&(await get('/sw.js')).includes('/preview-probe/*'));
    fs.writeFileSync(policyFile,policy('enable',11));
    await until('restored routes reproduce policy and worker',async()=>{assert.deepEqual(await state(),configured);return true;});
    const workerFile=path.join(source,'module/assets/js/pwa/worker-enable.js.tmpl'),originalWorker=fs.readFileSync(workerFile,'utf8');
    fs.appendFileSync(workerFile,'\nglobalThis.banyanPreviewWorker = "worker-rebuilt";\n');
    await until('worker template edits invalidate cached resources',async()=>(await get('/sw.js')).includes('worker-rebuilt'));
    fs.writeFileSync(workerFile,originalWorker);
    await until('restored worker template reproduces the original bytes',async()=>{assert.deepEqual(await state(),configured);return true;});
    const managerFile=path.join(source,'module/assets/js/pwa/manager-entry.js.tmpl'),originalManager=fs.readFileSync(managerFile,'utf8');
    fs.appendFileSync(managerFile,'\nglobalThis.banyanPreviewManager = "manager-rebuilt";\n');
    await until('manager template edits update four-language tags and SRI',async()=>(await managers('enable')).includes('manager-rebuilt'));
    fs.writeFileSync(managerFile,originalManager);
    await until('restored manager template restores four-language tags and SRI',async()=>{assert.equal(await managers('enable'),initialManager);return true;});
    const configOffset=logs.length;
    fs.writeFileSync(configFile,versionConfig('v-sw-preview-two'));
    await until('build version edits republish JSON',async()=>JSON.parse(await get('/sw-version.json'))==='v-sw-preview-two');
    await until('configuration rebuild completes',async()=>/Rebuilt in \d+/.test(logs.slice(configOffset)));
    const restoreOffset=logs.length;
    fs.writeFileSync(configFile,versionConfig('v-sw-preview-one'));
    await until('restored build version republishes the original JSON',async()=>{assert.deepEqual(await state(),configured);return true;});
    await until('restored configuration rebuild completes',async()=>/Rebuilt in \d+/.test(logs.slice(restoreOffset)));
    fs.writeFileSync(policyFile,policy('disable'));
    await until('disable selects cleanup worker and manager',async()=>Boolean(await managers('disable'))&&(await get('/sw.js')).includes('navigationPreload.disable()'));
    const disabledWorker=await get('/sw.js');
    fs.writeFileSync(policyFile,policy('enable',11));
    await until('re-enabling the same configuration restores worker and manager',async()=>{
      assert.deepEqual(await state(),configured);assert.equal(await managers('enable'),initialManager);return true;
    });
    fs.writeFileSync(policyFile,policy('disable'));
    await until('disabling again restores the same cleanup worker',async()=>{
      await managers('disable');assert.equal(await get('/sw.js'),disabledWorker);return true;
    });
    fs.writeFileSync(policyFile,policy('off'));
    await until('off removes managers from every language',async()=>{await managers('off');return true;});
    fs.writeFileSync(policyFile,policy('enable'));
    await until('re-enabling after off restores the initial outputs',async()=>{
      assert.deepEqual(await state(),initial);assert.equal(await managers('enable'),initialManager);return true;
    });
    assert.equal(fs.existsSync(path.join(work,'preview/__pwa')),false,'Intermediate templates must not be published.');
  } finally {
    if(server&&server.exitCode===null) {
      const closed=new Promise(resolve=>server.once('close',resolve));
      const killed=spawnSync('taskkill',['/pid',String(server.pid),'/t','/f'],{windowsHide:true,encoding:'utf8'});
      assert.equal(killed.status,0,killed.stderr||String(killed.error||'Could not stop preview.'));
      await closed;
    }
    assert.equal(path.dirname(fs.realpathSync.native(work)),parent);fs.rmSync(work,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
