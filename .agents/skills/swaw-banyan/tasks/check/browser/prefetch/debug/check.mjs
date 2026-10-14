import assert from 'node:assert/strict';
import {visit,runtimeState} from '../_shared/page.mjs';

const panelKeys=['support','env','actions','runtime','payload'];
const backends=['auto','native','sw','link','off'];
const modes=['conservative','moderate','eager','immediate'];

function expectedGroups(state,config,prerender=false) {
  const groups={};
  for(const candidate of prerender?state.prerenderCandidates:state.candidates) {
    const mode=config[candidate.rule];
    if(!modes.includes(mode))continue;
    const urls=groups[mode]??=[];
    if(!urls.includes(candidate.href))urls.push(candidate.href);
  }
  return Object.fromEntries(Object.entries(groups).map(([mode,urls])=>[mode,urls.sort()]));
}

function sortedGroups(groups) {
  assert.ok(groups&&typeof groups==='object'&&!Array.isArray(groups),'Potential actions must be grouped URL arrays.');
  return Object.fromEntries(Object.entries(groups).map(([mode,urls])=>{
    assert.ok(modes.includes(mode),'Potential actions must use the published eagerness values.');
    assert.ok(Array.isArray(urls)&&urls.every(url=>typeof url==='string'),'Potential actions must contain URL arrays.');
    assert.equal(new Set(urls).size,urls.length,'Each potential action must contain a URL only once.');
    return [mode,[...urls].sort()];
  }));
}

export async function check({page,baseUrl,options}) {
  await visit(page,new URL(options.page,baseUrl).href);
  assert.equal(await page.locator('body[data-prefetch-debug]').count(),1,'The diagnostic layout must scope its controls to this page.');
  for(const key of panelKeys)assert.equal(await page.locator('#prefetch-debug-'+key).count(),1,'Missing prefetch debug panel: '+key);
  await page.waitForFunction(keys=>keys.every(key=>{
    try {
      const value=JSON.parse(document.getElementById('prefetch-debug-'+key).textContent);
      return value&&typeof value==='object'&&(key!=='support'||value.serviceWorker.status!=='pending');
    }catch{return false;}
  }),panelKeys);
  const state=await runtimeState(page);
  const observed=await page.evaluate(keys=>({
    panels:Object.fromEntries(keys.map(key=>[key,JSON.parse(document.getElementById('prefetch-debug-'+key).textContent)])),
    runtime:window.banyanPrefetchState,
    backend:document.documentElement.dataset.prefetchBackend,
    selected:document.getElementById('prefetch-debug-backend').value,
    options:[...document.getElementById('prefetch-debug-backend').options].map(option=>option.value),
    status:document.getElementById('prefetch-debug-status').textContent.trim(),
    nativeRules:document.getElementById('site-speculation-rules')?.textContent,
    linkSupported:document.createElement('link').relList.supports('prefetch'),
    workerSupported:'serviceWorker' in navigator,
    secureContext:window.isSecureContext,
    links:[...document.querySelectorAll('a[data-prefetch-test-link]')].map(anchor=>({
      href:anchor.href,kind:anchor.dataset.prefetchTestLink,listEntry:anchor.hasAttribute('data-list-entry'),
      icon:anchor.querySelector('.item-icon > svg')?.getAttribute('class')
    }))
  }),panelKeys);
  const {panels,runtime}=observed;
  assert.deepEqual(observed.options,backends,'The diagnostic must expose one five-choice control.');
  assert.equal(await page.locator('#prefetch-debug-controls button[type=submit]').count(),1,'The control must provide Apply and reload.');
  assert.equal(await page.locator('label[for=prefetch-debug-backend]').count(),1,'The backend control must have a label.');
  assert.equal(await page.locator('#prefetch-debug-status[role=status][aria-live=polite]').count(),1,'Backend results must have a live status.');
  assert.ok(observed.status,'Backend results must be visible.');
  assert.equal(observed.selected,runtime.requested,'The control must show the requested backend.');
  assert.equal(observed.backend,runtime.backend,'The page must publish the selected backend.');
  assert.deepEqual(panels.env,{requested:runtime.requested,backend:runtime.backend,reason:runtime.reason},'Diagnostics must report the actual backend result.');
  if(runtime.requested==='off')assert.deepEqual(panels.env,{requested:'off',backend:'off',reason:'requested-off'},'Off must suppress prefetch on this diagnostic page.');
  else if(runtime.requested!=='auto') {
    assert.ok([runtime.requested,'off'].includes(runtime.backend),'A forced unavailable backend must not fall back.');
    assert.equal(runtime.reason,runtime.backend==='off'?runtime.requested+'-unavailable':'forced-'+runtime.requested,'A forced backend must report availability.');
  }
  assert.equal(panels.support.speculationRules,state.supported,'Diagnostics must report actual native support.');
  assert.equal(panels.support.linkPrefetch,observed.linkSupported,'Diagnostics must report actual link support.');
  assert.equal(panels.support.serviceWorkerApi,observed.workerSupported,'Diagnostics must report actual worker API support.');
  assert.equal(panels.support.secureContext,observed.secureContext,'Diagnostics must report the actual secure context.');
  assert.equal(panels.runtime.dispatched,runtime.dispatched,'Diagnostics must report actual custom dispatches.');
  assert.equal(panels.runtime.failures,runtime.failures,'Diagnostics must report known dispatch failures.');
  assert.equal(panels.runtime.prefetchReady,state.ready,'Diagnostics must report the shared readiness gate.');
  assert.equal(panels.runtime.nativeReady,state.nativeReady,'Diagnostics must report native activation.');
  assert.deepEqual(panels.payload.config,state.payload,'Diagnostics must preserve the inline configuration.');
  assert.deepEqual(panels.payload.selectors,state.rules,'Diagnostics must preserve the shared selectors.');
  assert.deepEqual(sortedGroups(panels.actions.prefetch),expectedGroups(state,state.payload.modes),'Potential prefetch actions must match page candidates.');
  assert.deepEqual(sortedGroups(panels.actions.prerender),expectedGroups(state,state.payload.prerender,true),'Potential prerender actions must match enabled page candidates.');
  if(observed.nativeRules)assert.deepEqual(panels.payload.publishedNativeRules,JSON.parse(observed.nativeRules),'Diagnostics must preserve the published native rules.');
  else assert.ok(panels.payload.publishedNativeRules===null||typeof panels.payload.publishedNativeRules==='object','Published native rules must remain readable after a backend switch.');
  assert.ok(observed.links.length<=2,'Diagnostics need at most one collection and one article test link.');
  for(const link of observed.links) {
    assert.equal(new URL(link.href).origin,new URL(page.url()).origin,'Test links must remain on the published site.');
    assert.ok((await page.request.head(link.href)).ok(),'Test links must reference a published page: '+link.href);
    assert.equal(link.listEntry,true,'Test links must use the shared list helper.');
    assert.ok(link.icon?.includes(link.kind==='collection'?'icon-folder':'icon-file'),'Test links must retain their icon semantics.');
  }
  return {page:options.page,panels};
}
