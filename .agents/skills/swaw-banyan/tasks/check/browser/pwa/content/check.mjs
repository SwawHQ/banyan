import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {setTimeout} from 'node:timers/promises';
import {waitForState,waiting} from '../_shared/state.mjs';
import {visit,update,version,observe,quiet} from '../_shared/update.mjs';
import {pageResources,missingResources} from '../_shared/resources.mjs';

async function contentBuilds(options) {
  const old=await fs.realpath(options.dir),next=await fs.realpath(options.next);
  assert.notEqual(old,next,'Content checks need two different build directories.');
  const scripts=[],versions=[];
  for(const directory of [old,next]) {
    assert.ok((await fs.stat(path.join(directory,'index.html'))).isFile(),'Both builds must contain index.html.');
    scripts.push(await fs.readFile(path.join(directory,'sw.js')));
    const value=JSON.parse(await fs.readFile(path.join(directory,'sw-version.json'),'utf8'));
    assert.ok(typeof value.version==='string'&&value.version.trim(),'Both builds must identify their content version.');
    versions.push(value.version);
  }
  assert.ok(scripts[0].equals(scripts[1]),'Content updates must retain identical sw.js bytes.');
  assert.notEqual(versions[0],versions[1],'Content updates need different sw-version.json versions.');
  return {old,next,versions};
}

async function cacheState(page,urls,resources=[]) {
  const state=await page.evaluate(async urls=>{
    const keys=await caches.keys(),navigation=keys.filter(key=>key.startsWith('nav-html-'));
    const fingerprints=keys.includes('asset-fingerprint')
      ?(await (await caches.open('asset-fingerprint')).keys()).map(request=>request.url):[];
    const pages=await Promise.all(navigation.map(async key=>({key,
      cached:await Promise.all(urls.map(async url=>Boolean((await (await caches.open(key)).match(url))?.ok)))
    })));
    return {keys,fingerprints,pages};
  },urls);
  return {...state,missing:await missingResources(page,resources)};
}

export async function check({page,context=page.context(),server,baseUrl,options}) {
  const pair=await contentBuilds(options),target=new URL(options.page,baseUrl).href,from=new URL(options.from,baseUrl).href;
  assert.notEqual(from,target,'Content checks need two different page paths.');
  const timeout=options.timeout??15000,events=observe(page),extra=[];
  let readerEvents,requests=0,programDirectory;
  const onRequest=request=>{if(new URL(request.url()).pathname==='/sw-version.json')requests++;};
  try {
    await server.setRoot(pair.old);await visit(page,target,timeout);
    const before=await version(page);assert.equal(before,pair.versions[0],'The panel must show the initial content version.');
    await visit(page,from,timeout);
    const reader=await context.newPage();extra.push(reader);readerEvents=observe(reader);await visit(reader,target,timeout);
    await reader.evaluate(()=>{
      window.__swbanContentController=navigator.serviceWorker.controller;
      window.__swbanContentDraft='preserved';
      const input=document.createElement('textarea');input.id='swban-content-draft';input.value='An unsaved draft';document.body.append(input);
    });
    const resources=await pageResources(page,baseUrl,pair.versions[0]);
    const cachesBefore=await waitForState(async()=>{
      const value=await cacheState(page,[target,from],resources);
      return value.pages.some(item=>item.key==='nav-html-'+pair.versions[0]&&item.cached.every(Boolean))
        &&value.keys.includes('asset-versioned-'+pair.versions[0])&&!value.missing.length?value:null;
    },timeout,'The old content and resources must enter their configured caches.');
    const burst=await Promise.all([context.newPage(),context.newPage()]);extra.push(...burst);
    const workers=context.serviceWorkers();assert.equal(workers.length,1,'Content checks need one active SW program.');
    programDirectory=await fs.mkdtemp(path.join(os.tmpdir(),'swban-content-program-'));
    await fs.cp(pair.next,programDirectory,{recursive:true});
    await fs.appendFile(path.join(programDirectory,'sw.js'),'\n// Waiting program probe\n');
    await server.setRoot(programDirectory);await update(page,timeout);
    await workers[0].evaluate(()=>{
      const now=Date.now.bind(Date);Date.now=()=>now()+6*60*1000;
    });
    events.loads=0;readerEvents.loads=0;context.on('request',onRequest);
    const started=performance.now();
    await Promise.all([visit(page,from,timeout),...burst.map(tab=>visit(tab,target,timeout))]);
    for(const tab of burst)assert.equal(await version(tab),before,'Pending content checks must retain the cached page.');
    await setTimeout(Math.max(0,14000-(performance.now()-started)));
    assert.equal(requests,0,'Content JSON must not be requested before the 15-second delay.');
    const cachesAfter=await waitForState(async()=>{
      const value=await cacheState(page,[target,from]),current=pair.versions[1];
      return value.keys.includes('nav-html-'+current)&&value.keys.includes('asset-versioned-'+current)
        &&value.keys.filter(key=>key.startsWith('nav-html-')||key.startsWith('asset-versioned-'))
          .every(key=>key==='nav-html-'+current||key==='asset-versioned-'+current)?value:null;
    },timeout+15000,'The content check must switch both cache groups and delete old versions.');
    assert.equal(requests,1,'Concurrent navigations must issue only one content-version request.');
    if(cachesBefore.fingerprints.length)assert.ok(cachesAfter.keys.includes('asset-fingerprint'),'Content changes must preserve the fingerprint cache.');
    for(const url of cachesBefore.fingerprints)assert.ok(cachesAfter.fingerprints.includes(url),'Content changes must retain cached fingerprinted resources.');
    assert.equal(await reader.evaluate(()=>navigator.serviceWorker.controller===window.__swbanContentController),true,
      'Content changes must retain the active controller.');
    await waiting(reader,timeout);
    assert.equal(context.serviceWorkers()[0],workers[0],'Content changes must retain the SW program.');
    assert.equal(await reader.evaluate(()=>window.__swbanContentDraft),'preserved','Content changes must preserve another tab.');
    assert.equal(await reader.locator('#swban-content-draft').inputValue(),'An unsaved draft','Content changes must preserve unsaved input.');
    assert.equal(await version(reader),before,'Content changes must not replace the reader document.');
    await visit(page,target,timeout);const after=await version(page);
    assert.equal(after,pair.versions[1],'The next navigation must display the new content.');
    assert.equal(events.loads,2,'Content changes must not add a page reload.');
    assert.equal(readerEvents.loads,0,'Content changes must not reload another tab.');
    assert.equal(requests,1,'Navigations within the check interval must not request the version again.');
    quiet(events);quiet(readerEvents);

    return {page:options.page,from:options.from,before,after,requests,cachesBefore:cachesBefore.keys,cachesAfter:cachesAfter.keys,
      fingerprintedResources:cachesBefore.fingerprints.length,readerPreserved:true,controllerPreserved:true,waitingProgramContentUpdated:true};
  }finally{
    context.off('request',onRequest);events.stop();readerEvents?.stop();
    await Promise.all(extra.map(tab=>tab.close()));
    if(programDirectory){
      assert.equal(path.dirname(programDirectory),os.tmpdir());
      assert.ok(path.basename(programDirectory).startsWith('swban-content-program-'));
      await fs.rm(programDirectory,{recursive:true,force:true});
    }
  }
}
