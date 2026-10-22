import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';
import {waitForState} from '../_shared/state.mjs';
import {pageResources,missingResources} from '../_shared/resources.mjs';

async function cacheState(page,assets,worker) {
  const state=await page.evaluate(async worker=>{
    const keys=await caches.keys(),navigation=keys.filter(key=>key.startsWith('nav-html-'));
    const pages=await Promise.all(navigation.map(async key=>({key,cached:Boolean((await (await caches.open(key)).match(location.href))?.ok)})));
    const cachedWorkers=[],cachedVersions=[],script=new URL(worker);
    for(const key of keys)for(const request of await (await caches.open(key)).keys()) {
      const url=new URL(request.url);
      if(url.origin===script.origin&&url.pathname===script.pathname)cachedWorkers.push(key);
      if(key!=='sw-content-state'&&url.origin===script.origin&&url.pathname==='/sw-version.json')cachedVersions.push(key);
    }
    return {keys,pages,cachedWorkers,cachedVersions};
  },worker);
  return {...state,missing:await missingResources(page,assets)};
}

export async function check({page,baseUrl,options}) {
  const context=page.context(),expected=new URL(options.page,baseUrl).href,timeout=options.timeout??15000,errors=[];
  assert.equal(context.serviceWorkers().length,0,'Offline checks must start in a fresh context without workers.');
  const onError=error=>errors.push(error.message);page.on('pageerror',onError);
  let offline=false;
  const assets=new Set(),responses=new Map(),failures=[];
  const onResponse=response=>{if(offline&&assets.has(response.url()))responses.set(response.url(),{ok:response.ok(),worker:response.fromServiceWorker()});};
  const onFailure=request=>{if(offline&&assets.has(request.url()))failures.push(request.url());};
  page.on('response',onResponse);page.on('requestfailed',onFailure);
  try {
    const initial=await page.goto(expected,{waitUntil:'load'});
    assert.ok(initial?.ok(),'Offline checks need a successful first page response.');
    assert.equal(initial.fromServiceWorker(),false,'The first visit must load before a worker controls the page.');
    await waitForBrowse(page);await afterPaint(page);
    assert.equal(page.url(),expected,'The first visit must retain the selected page.');
    const html=await initial.text(),title=await page.title(),language=await page.locator('html').getAttribute('lang');
    const registration=await waitForState(()=>page.evaluate(async()=>{
      const registration=await navigator.serviceWorker?.getRegistration();
      if(registration?.active?.state!=='activated'||navigator.serviceWorker.controller!==registration.active)return null;
      return {worker:registration.active.scriptURL,scope:registration.scope,updateViaCache:registration.updateViaCache,
        preload:registration.navigationPreload?await registration.navigationPreload.getState():null};
    }),timeout,'The first page must get an active controlling Service Worker.');
    assert.equal(new URL(registration.worker).origin,new URL(baseUrl).origin,'The worker must belong to the local site.');
    assert.equal(registration.updateViaCache,'none','Worker update checks must bypass the HTTP cache.');
    if(registration.preload)assert.equal(registration.preload.enabled,false,'Cache-first navigation must keep navigation preload disabled.');
    const initialDocumentCached=(await cacheState(page,[],registration.worker)).pages.some(value=>value.cached);
    const controlled=await page.reload({waitUntil:'load'});
    assert.ok(controlled?.ok()&&controlled.fromServiceWorker(),'A controlled navigation must load through the worker.');
    await waitForBrowse(page);await afterPaint(page);
    const workerResponse=await context.request.get(registration.worker);
    assert.ok(workerResponse.ok(),'The active worker script must be available.');
    assert.equal(workerResponse.headers()['cache-control'],'no-cache, max-age=0, must-revalidate','The worker script must revalidate on every request.');
    const versionResponse=await context.request.get(new URL('/sw-version.json',baseUrl).href);
    assert.ok(versionResponse.ok(),'The content version JSON must be available.');
    assert.equal(versionResponse.headers()['cache-control'],'no-cache, max-age=0, must-revalidate','The content version JSON must revalidate on every request.');
    const {version:contentVersion}=await versionResponse.json();
    assert.ok(typeof contentVersion==='string'&&contentVersion.trim(),'The content version JSON must identify the current content.');
    const resources=await pageResources(page,baseUrl,contentVersion);
    assert.ok(resources.length>0,'The first page must load local CSS or JS.');
    assert.deepEqual(resources.filter(resource=>resource.bucket==='off').map(resource=>new URL(resource.url).pathname),[],
      'Full offline CSS/JS coverage requires SW caching; off resources are unavailable after clearing the HTTP cache.');
    for(const resource of resources)assets.add(resource.url);
    let before;
    try {
      before=await waitForState(async()=>{
        const state=await cacheState(page,resources,registration.worker);
        return state.pages.length===1&&state.pages[0].cached&&!state.missing.length?state:null;
      },timeout,'The controlled page and its CSS/JS must enter their configured caches before going offline.');
    }catch(error){
      error.details=await cacheState(page,resources,registration.worker);throw error;
    }
    assert.equal(before.pages[0].key,'nav-html-'+contentVersion,'The navigation cache must carry the content version.');
    assert.deepEqual(before.cachedWorkers,[],'The worker script must never enter Cache Storage.');
    assert.deepEqual(before.cachedVersions,[],'The content version JSON must not enter content caches.');
    // Remove HTTP cache as an alternative source of offline CSS/JS. Cache Storage stays intact.
    const session=await context.newCDPSession(page);
    try{await session.send('Network.clearBrowserCache');}finally{await session.detach();}
    await context.setOffline(true);offline=true;
    let response;
    try{response=await page.reload({waitUntil:'load'});}
    catch(error){throw new Error('The cached first page must reload successfully offline.',{cause:error});}
    assert.ok(response?.ok(),'The cached first page must reload successfully offline.');
    assert.ok(response.fromServiceWorker(),'The offline document must come from the Service Worker.');
    assert.equal(await response.text(),html,'Offline reload must return the original page HTML.');
    await waitForBrowse(page);await afterPaint(page);
    assert.equal(page.url(),expected,'Offline reload must retain the selected page.');
    assert.equal(await page.title(),title,'The offline page must keep its title.');
    assert.equal(await page.locator('html').getAttribute('lang'),language,'The offline page must keep its language.');
    assert.ok(await page.locator('main').isVisible(),'The offline page must render its main content.');
    assert.deepEqual(failures,[],'Cached CSS/JS must not fail during offline reload.');
    for(const url of assets)assert.deepEqual(responses.get(url),{ok:true,worker:true},'Offline CSS/JS must come from the worker: '+new URL(url).pathname);
    const after=await cacheState(page,resources,registration.worker);
    assert.deepEqual(after.cachedWorkers,[],'Offline reload must not cache the worker script.');
    assert.deepEqual(after.cachedVersions,[],'Offline reload must not cache the content version JSON.');
    assert.deepEqual(errors,[],'The first visit and offline reload must not raise uncaught errors.');
    return {page:options.page,registration,navigationCache:before.pages[0].key,assets:[...assets].map(url=>new URL(url).pathname),assetBuckets:Object.fromEntries(resources.map(resource=>[new URL(resource.url).pathname,resource.bucket])),initialDocumentCached,controlledNavigation:true,offlineDocument:true,offlineAssets:responses.size};
  }finally{
    if(offline)await context.setOffline(false);
    page.off('pageerror',onError);page.off('response',onResponse);page.off('requestfailed',onFailure);
  }
}
