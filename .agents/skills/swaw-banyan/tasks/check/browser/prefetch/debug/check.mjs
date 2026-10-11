import assert from 'node:assert/strict';
import {visit,runtimeState,targets,coordinated} from '../_shared/page.mjs';

const panelKeys=['support','env','actions','spec-owned','actions-filtered','payload'];
function urls(actions) {
  assert.ok(actions&&typeof actions==='object'&&!Array.isArray(actions),'Debug actions must be an object of URL arrays.');
  assert.ok(Object.values(actions).every(value=>Array.isArray(value)&&value.every(url=>typeof url==='string')),
    'Debug action groups must contain URL arrays.');
  return [...new Set(Object.values(actions).flat())].sort();
}

export async function check({page,baseUrl,options}) {
  const response=await visit(page,new URL(options.page,baseUrl).href),state=await runtimeState(page);coordinated(state);
  for(const key of panelKeys)assert.equal(await page.locator('#prefetch-debug-'+key).count(),1,'Missing prefetch debug panel: '+key);
  // Parsing readiness does not depend on the site's translated loading label.
  await page.waitForFunction(keys=>keys.every(key=>{
    try {const value=JSON.parse(document.getElementById('prefetch-debug-'+key).textContent);return value&&typeof value==='object';}
    catch{return false;}
  }),panelKeys);
  const panels=await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,
    JSON.parse(document.getElementById('prefetch-debug-'+key).textContent)])),panelKeys);
  assert.equal(panels.support.speculationRules,state.supported,'Debug must report actual speculation support.');
  assert.equal(panels.support.linkPrefetch,state.link,'Debug must report actual link prefetch support.');
  assert.equal(panels.support.serviceWorkerApi,state.sw,'Debug must report actual worker API support.');
  assert.equal(panels.env.runtimeEnvSequence,state.environment,'Debug must report the actual runtime environment.');
  assert.equal(panels.env.runtimeCoordinationMode,state.meta.coordination_mode,'Debug must report page coordination mode.');
  assert.equal(panels.env.preemptionActive,true,'Debug must report active preemption.');
  assert.deepEqual(panels['spec-owned'].declaredOwnedSlots,state.meta.owned_slots,'Debug must preserve declared owned slots.');
  assert.deepEqual(panels['spec-owned'].activeOwnedSlots,state.meta.owned_slots,'Debug must report active owned slots.');
  const raw=targets(state),remaining=targets(state,state.meta.owned_slots);
  assert.deepEqual(urls(panels.actions),raw.sort(),'Debug raw actions must match configured page candidates.');
  assert.deepEqual(urls(panels['actions-filtered'].filteredActions),remaining.sort(),'Debug must retain actions in unowned slots.');
  // A shared URL can leave an owned eager group and remain in an unowned
  // conservative group. Compare suppression within each action group.
  const suppressed=Object.fromEntries(Object.entries(panels.actions).map(([key,values])=>[key,
    values.filter(href=>!panels['actions-filtered'].filteredActions[key]?.includes(href))]).filter(([,values])=>values.length));
  urls(panels['actions-filtered'].suppressedActions);
  assert.deepEqual(panels['actions-filtered'].suppressedActions,suppressed,'Debug must report exactly the suppressed actions.');
  assert.deepEqual(panels.payload.runtimeMeta,state.meta,'Debug payload must preserve runtime metadata.');
  assert.deepEqual(panels.payload.runtimePayload,state.payload,'Debug payload must preserve runtime configuration.');
  const header=response.headers()['speculation-rules']??'';
  assert.ok(header,'Debug checks require a Speculation-Rules response header.');
  assert.equal(panels.payload.speculationRulesHeader,header,'Debug must report the actual response header.');
  assert.ok(panels.payload.speculationRulesPayload,'Debug must expose the fetched rules payload.');
  return {page:options.page,panels};
}
