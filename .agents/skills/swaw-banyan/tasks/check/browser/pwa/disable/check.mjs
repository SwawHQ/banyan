import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {insideOutput,localReference} from '../../../../_shared/output.mjs';
import {waitForState} from '../_shared/state.mjs';
import {visit,observe,quiet} from '../_shared/update.mjs';
import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';

const managed=key=>key==='asset-fingerprint'||['nav-html-','asset-versioned-'].some(prefix=>key.startsWith(prefix));
const probes=['swban-unrelated-cache','asset-fingerprint-unrelated','nav-htmlish-unrelated'];
const storageKey='swban-disable-probe';

async function read(page) {
  return page.evaluate(async({probes,storageKey})=>({
    cacheKeys:await caches.keys(),controller:navigator.serviceWorker.controller?.scriptURL??'',
    registrations:(await navigator.serviceWorker.getRegistrations()).map(registration=>({
      scope:registration.scope,active:registration.active?.scriptURL??''
    })).sort((a,b)=>a.scope.localeCompare(b.scope)),
    probes:await Promise.all(probes.map(async key=>{
      const response=await caches.match(location.origin+'/swban-cache-probe',{cacheName:key});
      return response?await response.text():null;
    })),
    local:localStorage.getItem(storageKey),session:sessionStorage.getItem(storageKey)
  }),{probes,storageKey});
}

function preserved(state,otherRegistrations) {
  assert.deepEqual(state.probes,probes,'Cleanup must preserve unrelated cache contents and similar cache names.');
  assert.equal(state.local,'local preserved','Cleanup must preserve unrelated localStorage.');
  assert.equal(state.session,'session preserved','Cleanup must preserve unrelated sessionStorage.');
  assert.deepEqual(state.registrations.filter(registration=>new URL(registration.scope).pathname!=='/'),otherRegistrations,
    'Cleanup must preserve registrations in other scopes.');
}

async function selectedBuild(directory,page,manager) {
  const root=await fs.realpath(directory);
  assert.ok((await fs.stat(path.join(root,'index.html'))).isFile(),'Both builds must contain index.html.');
  let file=insideOutput(root,localReference(page));
  if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
  const html=await fs.readFile(file,'utf8');
  const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']?([^"'\s>]+)/gi)].map(value=>value[1]);
  assert.equal(scripts.filter(src=>src.includes('sw-manager.'+manager+'.')).length,1,
    'The '+manager+' build must contain one '+manager+' manager on --page.');
  assert.equal(scripts.filter(src=>src.includes('sw-manager.'+(manager==='enable'?'disable':'enable')+'.')).length,0,
    'The build must not mix enable and disable managers.');
  return {root,worker:await fs.readFile(path.join(root,'sw.js'))};
}

export async function check({page,server,baseUrl,options}) {
  assert.ok(options.dir&&options.next,'Cleanup requires an enabled build and --next disabled build.');
  const old=await selectedBuild(options.dir,options.page,'enable'),next=await selectedBuild(options.next,options.page,'disable');
  assert.notEqual(old.root,next.root,'Cleanup needs two different build directories.');
  assert.ok(!old.worker.equals(next.worker),'Enable and disable builds must have different sw.js bytes.');
  const timeout=options.timeout??15000,href=new URL(options.page,baseUrl).href,scope=baseUrl+'/',events=observe(page);
  try {
    await server.setRoot(old.root);await visit(page,href,timeout);
    await waitForState(()=>page.evaluate(async()=>{
      const keys=await caches.keys(),nav=keys.filter(key=>key.startsWith('nav-html-'));
      const assets=keys.includes('asset-fingerprint')?await (await caches.open('asset-fingerprint')).keys():[];
      const counts=await Promise.all(nav.map(async key=>(await (await caches.open(key)).keys()).length));
      return assets.length>0&&counts.some(count=>count>0);
    }),timeout,'The enabled worker must establish real navigation and fingerprinted asset caches.');
    await page.evaluate(async({probes,storageKey})=>{
      for(const key of ['asset-versioned-swban-probe',...probes]) {
        await (await caches.open(key)).put(location.origin+'/swban-cache-probe',new Response(key));
      }
      localStorage.setItem(storageKey,'local preserved');sessionStorage.setItem(storageKey,'session preserved');
      window.__swbanDisableController=navigator.serviceWorker.controller;window.__swbanDisableDocument='preserved';
    },{probes,storageKey});
    const before=await read(page),rootRegistrations=before.registrations.filter(registration=>registration.scope===scope);
    assert.equal(rootRegistrations.length,1,'The enabled build must register one root-scoped worker.');
    const otherRegistrations=before.registrations.filter(registration=>registration.scope!==scope);
    events.loads=0;await server.setRoot(next.root);
    await page.evaluate(async scope=>{
      const registration=await navigator.serviceWorker.getRegistration(scope);
      if(!registration)throw new Error('No root worker to update.');await registration.update();
    },scope);
    // Validate the worker independently, before the new page manager can repair it.
    await waitForState(()=>page.evaluate(async()=>{
      const registration=await navigator.serviceWorker.getRegistration(location.origin+'/');
      const keys=await caches.keys(),controller=navigator.serviceWorker.controller;
      return registration?.active?.state==='activated'&&controller===registration.active&&controller!==window.__swbanDisableController
        &&!keys.some(key=>key==='asset-fingerprint'||['nav-html-','asset-versioned-'].some(prefix=>key.startsWith(prefix)));
    }),timeout,'The disable worker must take control and remove managed caches before reload.');
    const worker=await read(page);preserved(worker,otherRegistrations);
    assert.equal(await page.evaluate(()=>window.__swbanDisableDocument),'preserved','Worker cleanup must keep the open document.');
    assert.equal(events.loads,0,'Worker cleanup must not reload the reading page.');
    assert.equal(page.url(),href,'Worker cleanup must preserve the reading URL.');
    assert.equal(worker.registrations.filter(registration=>registration.scope===scope).length,1,
      'Worker cleanup must leave its registration for the page manager to unregister.');

    // Recreate managed caches: the manager must also clean without worker repair.
    await page.evaluate(async()=>{
      for(const key of ['nav-html-swban-manager-probe','asset-versioned-swban-manager-probe','asset-fingerprint'])
        await (await caches.open(key)).put(location.origin+'/swban-manager-probe',new Response('manager cleanup'));
    });
    const response=await page.reload({waitUntil:'load'});
    assert.ok(response?.ok(),'The disable page must reload successfully.');
    assert.equal(response.fromServiceWorker(),false,'The disable worker must stop serving cached navigation.');
    await waitForBrowse(page);await afterPaint(page);
    assert.equal(await page.locator('script[src*="sw-manager.disable."]').count(),1,'The reloaded page must use the disable manager.');
    const manager=await waitForState(async()=>{
      const state=await read(page);
      return !state.registrations.some(registration=>registration.scope===scope)&&!state.cacheKeys.some(managed)?state:null;
    },timeout,'The disable manager must unregister the root worker and clear managed caches.');
    preserved(manager,otherRegistrations);
    await page.reload({waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    const after=await read(page);preserved(after,otherRegistrations);
    assert.equal(after.controller,'','A further reload must have no service worker controller.');
    assert.ok(!after.registrations.some(registration=>registration.scope===scope),'Disable mode must not re-register its root worker.');
    assert.ok(!after.cacheKeys.some(managed),'Disable mode must not recreate managed caches.');
    assert.equal(page.url(),href,'Disable reloads must preserve the requested URL.');
    assert.equal(events.loads,2,'Cleanup must perform only the two requested reloads.');quiet(events);
    return {page:options.page,before,worker,manager,after};
  }finally{events.stop();}
}
