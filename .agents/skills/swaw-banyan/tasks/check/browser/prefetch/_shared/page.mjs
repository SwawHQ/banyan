import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';

export async function visit(page,href) {
  const response=await page.goto(href,{waitUntil:'load'});
  assert.ok(response?.ok(),'The prefetch page must return a successful response.');
  await waitForBrowse(page);await afterPaint(page);
  assert.equal(page.url(),href,'Prefetch checks must preserve the requested page URL.');
  return response;
}

export async function runtimeState(page) {
  return page.evaluate(()=>{
    const read=id=>{
      const node=document.getElementById(id);return node?JSON.parse(node.textContent):null;
    };
    const payload=read('site-prefetch-data'),meta=read('site-prefetch-runtime-meta');
    const link=document.createElement('link').relList.supports('prefetch'),sw='serviceWorker' in navigator;
    const environment=(link?'T':'F')+(sw?'T':'F'),entry=payload?.[environment];
    const config=typeof entry==='string'?payload[entry]:entry;
    const candidates=[...document.querySelectorAll('a[href][data-prefetch-slot]')].filter(anchor=>
      (!anchor.target||anchor.target.toLowerCase()==='_self')&&!anchor.hasAttribute('download')).map(anchor=>{
      const url=new URL(anchor.href);url.hash='';
      return {href:url.href,slot:anchor.dataset.prefetchSlot,mode:config?.[anchor.dataset.prefetchSlot]??'off'};
    });
    const current=new URL(location.href);current.hash='';
    return {payload,meta,environment,config,link,sw,current:current.href,candidates,
      supported:HTMLScriptElement.supports('speculationrules')};
  });
}

export function targets(state,suppressed=[]) {
  const slots=new Set(suppressed);
  return [...new Set(state.candidates.filter(candidate=>!slots.has(candidate.slot)
    &&/^(link|sw)_[smx]f(?:_g)?$/.test(candidate.mode)&&candidate.href!==state.current).map(candidate=>candidate.href))];
}

export function coordinated(state) {
  assert.equal(state.supported,true,'This check requires Speculation Rules support.');
  assert.equal(state.meta?.coordination_mode,'preempt_runtime_when_supported','The page must enable runtime preemption.');
  assert.ok(Array.isArray(state.meta.owned_slots)&&state.meta.owned_slots.length,'The page must declare speculation-owned slots.');
  assert.ok(state.config&&typeof state.config==='object','The page must publish a runtime config for this browser.');
  assert.ok(targets(state).length,'Choose a page with configured runtime link candidates.');
}
