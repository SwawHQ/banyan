import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';

export async function visit(page,href) {
  const response=await page.goto(href,{waitUntil:'load'});
  assert.ok(response?.ok(),'The prefetch page must return a successful response.');
  await waitForBrowse(page);await afterPaint(page);
  if(await page.locator('#site-prefetch-data').count())
    await page.waitForFunction(()=>Boolean(window.banyanPrefetchState?.backend)&&window.banyanPrefetchState.reason!=='selecting');
  assert.equal(page.url(),href,'Prefetch checks must preserve the requested page URL.');
  return response;
}
export async function runtimeState(page) {
  return page.evaluate(()=>{
    const read=id=>{const node=document.getElementById(id);return node?JSON.parse(node.textContent):null;};
    const payload=read('site-prefetch-data'),rules=read('site-prefetch-rules'),config=payload?.modes;
    const current=new URL(location.href);current.hash='';
    const candidatesFor=kind=>[...document.querySelectorAll('a[href]')].filter(anchor=>
      (!anchor.target||anchor.target.toLowerCase()==='_self')&&!anchor.hasAttribute('download')).flatMap(anchor=>{
      const url=new URL(anchor.href);url.hash='';
      if(!['http:','https:'].includes(url.protocol)||url.origin!==location.origin||
        !/(?:\/|\.html?)$/.test(url.pathname)||url.href===current.href)return [];
      const rule=(rules?.[kind]??[]).find(rule=>anchor.matches(rule.selector));
      const modes=kind==='prefetch'?config:payload?.prerender;
      return rule?[{href:url.href,rule:rule.id,mode:modes?.[rule.id]??'off'}]:[];
    });
    const candidates=candidatesFor('prefetch'),prerenderCandidates=candidatesFor('prerender');
    return {payload,rules,config,current:current.href,candidates,prerenderCandidates,runtime:window.banyanPrefetchState,
      ready:document.documentElement.hasAttribute('data-prefetch-ready'),
      nativeReady:document.documentElement.hasAttribute('data-prefetch-native-ready'),
      legacy:document.querySelectorAll('[data-prefetch-slot]').length,
      supported:HTMLScriptElement.supports('speculationrules')};
  });
}
export function targets(state) {
  return [...new Set(state.candidates.filter(candidate=>
    ['conservative','moderate','eager','immediate'].includes(candidate.mode)).map(candidate=>candidate.href))];
}
export function requireNativeBackend(state) {
  assert.equal(state.supported,true,'This check requires Speculation Rules support.');
  assert.equal(state.runtime?.backend,'native','The page must select the native backend.');
  assert.equal(state.nativeReady,true,'Native rules must activate after backend selection.');
  assert.equal(state.ready,true,'Prefetch selectors must activate after page initialization.');
  assert.equal(state.legacy,0,'Prefetch links must not carry legacy slot markers.');
  assert.ok(state.config&&typeof state.config==='object','The page must publish a unified prefetch config.');
  assert.ok(targets(state).length,'Choose a page with configured prefetch candidates.');
}
