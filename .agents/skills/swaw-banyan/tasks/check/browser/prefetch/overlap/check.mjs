import assert from 'node:assert/strict';
import {visit,runtimeState,targets,coordinated} from '../_shared/page.mjs';
import {afterPaint} from '../../../../_shared/browser/viewport.mjs';

function trace() {
  const state={links:[],messages:[]};window.__swbanPrefetchTrace=state;
  const normalize=href=>{const url=new URL(href,location.href);url.hash='';return url.href;};
  const append=Node.prototype.appendChild;
  Node.prototype.appendChild=function(node) {
    if(this===document.head&&node.tagName==='LINK'&&node.rel==='prefetch'&&node.dataset.prefetchLink==='runtime')
      state.links.push(normalize(node.href));
    return append.call(this,node);
  };
  if(typeof ServiceWorker!=='undefined') {
    const post=ServiceWorker.prototype.postMessage;
    ServiceWorker.prototype.postMessage=function(message,...args) {
      if(message?.type==='WARM_NAV_BATCH'&&Array.isArray(message.urls))state.messages.push(...message.urls.map(normalize));
      return post.call(this,message,...args);
    };
  }
}

export async function check({page,baseUrl,options}) {
  await page.addInitScript(trace);
  const href=new URL(options.page,baseUrl).href;await visit(page,href);
  const state=await runtimeState(page);coordinated(state);
  const raw=targets(state),remaining=targets(state,state.meta.owned_slots);
  // Ownership suppresses slots. A URL also present in an unowned slot remains
  // eligible there; URL overlap alone must not produce a false failure.
  const suppressed=raw.filter(href=>!remaining.includes(href));
  assert.ok(suppressed.length,'Choose a page with runtime URLs owned only by speculation slots.');
  const usesWorker=state.candidates.some(candidate=>/^sw_[smx]f(?:_g)?$/.test(candidate.mode));
  if(usesWorker) {
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
    await afterPaint(page);
  }
  // Exercise moderate/conservative actions through native focus without navigating.
  const anchors=page.locator('a[href][data-prefetch-slot]');
  const indices=await anchors.evaluateAll((nodes,config)=>{
    const seen=new Set(),indices=[];
    nodes.forEach((node,index)=>{
      const slot=node.dataset.prefetchSlot;
      if(!seen.has(slot)&&/^(link|sw)_[smx]f(?:_g)?$/.test(config[slot])&&node.getClientRects().length>0
        &&!node.hasAttribute('download')&&(!node.target||node.target==='_self')){
        const url=new URL(node.href);url.hash='';seen.add(slot);indices.push({index,href:url.href});
      }
    });return indices;
  },state.config);
  for(const {index} of indices) {
    await anchors.nth(index).focus();await afterPaint(page);
  }
  await page.waitForTimeout(250);
  const recorded=await page.evaluate(()=>window.__swbanPrefetchTrace);
  const actions=[...new Set([...recorded.links,...recorded.messages])].filter(href=>raw.includes(href));
  assert.deepEqual(actions.filter(href=>suppressed.includes(href)),[],'Runtime must not prefetch speculation-owned links.');
  const eagerRemaining=state.candidates.filter(candidate=>!state.meta.owned_slots.includes(candidate.slot)
    &&/^(link|sw)_xf(?:_g)?$/.test(candidate.mode)&&remaining.includes(candidate.href)).map(candidate=>candidate.href);
  const expected=[...new Set([...eagerRemaining,...indices.map(value=>value.href).filter(href=>remaining.includes(href))])];
  assert.ok(expected.every(href=>actions.includes(href)),'Runtime must still execute eager/focused actions in unowned slots.');
  assert.equal(page.url(),href,'Prefetch observation must not navigate away.');
  return {page:options.page,environment:state.environment,ownedSlots:state.meta.owned_slots,raw,remaining,suppressed,recorded,actions};
}
