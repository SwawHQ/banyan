import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {listenOnLoopback} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {parseHeaders,headerValues} from '../.agents/skills/swaw-banyan/tasks/_shared/headers.mjs';
import {extractTagAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
test('deployment preview follows configuration and inline scripts with a standalone primary homepage',{timeout:60000},async()=>{
  const parent=path.join(fs.realpathSync.native(os.tmpdir()),'swaw/banyan/deployment-preview');
  fs.mkdirSync(parent,{recursive:true});const work=fs.mkdtempSync(path.join(parent,'run-')),source=path.join(work,'site');
  fs.mkdirSync(source);let server,logs='',launchError;
  try {
    for(const name of ['content','assets','module','hugo.toml','go.mod','go.sum','layouts'])
      if(fs.existsSync(path.join(root,name)))fs.cpSync(path.join(root,name),path.join(source,name),{recursive:true});
    fs.mkdirSync(path.join(source,'layouts'),{recursive:true});
    fs.writeFileSync(path.join(source,'layouts/page-home.en.html'),'<!doctype html><html lang="en"><head><title>Standalone</title></head><body>STANDALONE_DEPLOYMENT</body></html>');
    const policyFile=path.join(source,'assets/site/delivery.toml'),originalPolicy=fs.readFileSync(policyFile,'utf8');
    const inlineFile=path.join(source,'module/assets/js/inline/theme-boot.js'),originalInline=fs.readFileSync(inlineFile,'utf8');
    const probe=net.createServer();await listenOnLoopback(probe);const port=probe.address().port;
    await new Promise(resolve=>probe.close(resolve));const base='http://127.0.0.1:'+port;
    server=spawn(toolExecutable('hugo'),['server','--noBuildLock','--enableGitInfo=false','--disableLiveReload',
      '--bind','127.0.0.1','--port',String(port),'--baseURL',base,'--destination',path.join(work,'preview')],
      {cwd:source,env:fixtureEnvironment(work),windowsHide:true,stdio:['ignore','pipe','pipe']});
    server.on('error',error=>{launchError=error;});
    for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{logs+=chunk;});
    const get=async route=>{const response=await fetch(base+route,{signal:AbortSignal.timeout(1500),headers:{Connection:'close'}});assert.equal(response.status,200,route);return response.text();};
    async function until(label,check) {
      const deadline=Date.now()+12000;let last;
      while(Date.now()<deadline) {
        if(launchError)throw launchError;assert.equal(server.exitCode,null,logs);
        try{if(await check())return;}catch(error){last=error;}
        await delay(100);
      }
      assert.fail(label+': '+last+'\n'+logs);
    }
    async function state() {
      const [headers,redirects,edgeText,...pages]=await Promise.all(['/_headers','/_redirects','/edgeone.json',
        ...['','/zh','/zh-tw','/ar'].map(prefix=>prefix+'/powered-by/')].map(get));
      const edge=JSON.parse(edgeText),csp=headerValues(parseHeaders(headers),'/*','Content-Security-Policy')[0];
      assert.equal(headerValues(edge.headers,'/*','Content-Security-Policy')[0],csp);
      const modes=[];
      for(const html of pages)for(const [,tag,body] of html.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/gi)) {
        const type=extractTagAttribute(tag,'type');
        if(extractTagAttribute(tag,'id')==='site-prefetch-data')modes.push(JSON.parse(body).modes['folder/root']);
        if(!extractTagAttribute(tag,'src')&&['','text/javascript','speculationrules'].includes(type)&&body.trim()) {
          const hash="'sha256-"+createHash('sha256').update(body).digest('base64')+"'";
          assert.ok(csp.includes(hash),'Each language must use inline scripts allowed by both deployment files.');
        }
      }
      assert.equal(modes.length,4);return {headers,redirects,edge,edgeText,csp,modes,pages};
    }
    let initial;
    await until('initial publication',async()=>{assert.match(await get('/'),/STANDALONE_DEPLOYMENT/);initial=await state();return true;});
    const changed=originalPolicy.replace('icons.folder.root = "moderate"','icons.folder.root = "immediate"')+
      '\n[[routes]]\npath = "/deployment-probe/*"\nhttp.headers.X-Deployment-Probe = "updated"\n'+
      '\n[[redirects]]\nsource = "/deployment-old/"\ndestination = "/deployment-new/"\nstatus = 301\n';
    assert.notEqual(changed,originalPolicy);fs.writeFileSync(policyFile,changed);
    let configured;
    await until('delivery and prefetch edits',async()=>{
      configured=await state();
      assert.ok(configured.headers.includes('X-Deployment-Probe: updated'));
      assert.ok(configured.redirects.includes('/deployment-old/ /deployment-new/ 301'));
      assert.ok(configured.edge.redirects.some(rule=>rule.source==='/deployment-old/'&&rule.destination==='/deployment-new/'));
      assert.ok(configured.modes.every(mode=>mode==='immediate'));assert.notEqual(configured.csp,initial.csp);return true;
    });
    fs.appendFileSync(inlineFile,'\nglobalThis.DEPLOYMENT_INLINE_PROBE = true;\n');
    await until('inline script edits',async()=>{
      const updated=await state();assert.ok(updated.pages.every(html=>html.includes('DEPLOYMENT_INLINE_PROBE')));
      assert.notEqual(updated.csp,configured.csp);return true;
    });
    fs.writeFileSync(policyFile,originalPolicy);
    await until('restored policy removes obsolete rules',async()=>{
      const restored=await state();assert.ok(restored.modes.every(mode=>mode==='moderate'));
      assert.ok(!restored.headers.includes('X-Deployment-Probe'));assert.ok(!restored.redirects.includes('/deployment-old/'));
      assert.ok(!restored.edge.redirects.some(rule=>rule.source==='/deployment-old/'));return true;
    });
    fs.writeFileSync(inlineFile,originalInline);
    await until('restored inputs reproduce the initial deployment files',async()=>{
      const restored=await state();
      for(const key of ['headers','redirects','edgeText'])assert.equal(restored[key],initial[key]);
      assert.ok(restored.pages.every(html=>!html.includes('DEPLOYMENT_INLINE_PROBE')));return true;
    });
  } finally {
    if(server&&server.exitCode===null&&server.pid) {
      const closed=new Promise(resolve=>server.once('close',resolve));
      const stopped=spawnSync('taskkill',['/pid',String(server.pid),'/t','/f'],{windowsHide:true,encoding:'utf8'});
      assert.equal(stopped.status,0,stopped.stderr||String(stopped.error||'Could not stop deployment preview.'));await closed;
    }
    assert.equal(path.dirname(fs.realpathSync.native(work)),parent);fs.rmSync(work,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
