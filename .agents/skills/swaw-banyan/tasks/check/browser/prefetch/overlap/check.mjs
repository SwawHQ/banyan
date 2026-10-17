import assert from 'node:assert/strict';
import {visit,runtimeState,targets,requireNativeBackend} from '../_shared/page.mjs';
import {afterPaint} from '../../_shared/viewport.mjs';

export function recordRuntime() {
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
  await page.addInitScript(recordRuntime);
  const href=new URL(options.page,baseUrl).href;await visit(page,href);
  const state=await runtimeState(page);requireNativeBackend(state);
  const candidates=targets(state),anchors=page.locator('a[href]');
  const indices=await anchors.evaluateAll((nodes,{rules,modes})=>{
    const seen=new Set(),indices=[];
    nodes.forEach((node,index)=>{
      const rule=rules.find(rule=>node.matches(rule.selector))?.id;
      if(rule&&!seen.has(rule)&&modes[rule]!=='off'&&node.getClientRects().length>0){
        seen.add(rule);indices.push(index);
      }
    });return indices;
  },{rules:state.rules.prefetch,modes:state.config});
  for(const index of indices){await anchors.nth(index).focus();await afterPaint(page);}
  await page.waitForTimeout(250);
  const recorded=await page.evaluate(()=>window.__swbanPrefetchTrace);
  assert.deepEqual([...recorded.links,...recorded.messages].filter(href=>candidates.includes(href)),[],
    'Selecting native rules must suppress all custom prefetch hints for candidate URLs.');
  assert.equal(page.url(),href,'Prefetch observation must not navigate away.');
  return {page:options.page,backend:state.runtime.backend,candidates,recorded};
}
