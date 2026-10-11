import assert from 'node:assert/strict';
import {setTimeout} from 'node:timers/promises';
import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';

export async function check({page,baseUrl,options}) {
  const expect=options.expect??'header',timeout=options.timeout??15000,href=new URL(options.page??'/',baseUrl).href;
  assert.ok(expect!=='off'||!options.eager,'--eager cannot be used with --expect off.');
  const session=await page.context().newCDPSession(page),rules=[],requests=new Map(),responses=new Map();
  session.on('Preload.ruleSetUpdated',event=>rules.push(event.ruleSet));
  session.on('Network.requestWillBeSent',event=>requests.set(event.requestId,event.request.url));
  session.on('Network.responseReceived',event=>responses.set(event.requestId,event.response));
  await page.addInitScript(()=>{
    window.__swbanRulesViolations=[];
    document.addEventListener('securitypolicyviolation',event=>window.__swbanRulesViolations.push({
      directive:event.effectiveDirective,blockedURI:event.blockedURI,disposition:event.disposition
    }));
  });
  try {
    await session.send('Network.enable');await session.send('Preload.enable');
    const response=await page.goto(href,{waitUntil:'load'});
    assert.ok(response?.ok(),'The rules page must return a successful response.');
    await waitForBrowse(page);await afterPaint(page);
    assert.equal(page.url(),href,'Rule checks must preserve the requested page URL.');
    const {frameTree}=await session.send('Page.getFrameTree'),loader=frameTree.frame.loaderId;
    const header=response.headers()['speculation-rules']??'';
    const inline=await page.locator('script[type="speculationrules"]').count();
    assert.equal(inline,0,'External rules must not depend on inline speculationrules scripts.');
    if(expect==='off') {
      assert.equal(header,'','Off mode must not send a Speculation-Rules header.');
      assert.deepEqual(rules.filter(rule=>rule.loaderId===loader),[],'Off mode must not register browser rules.');
      return {page:options.page??'/',enabled:false,header};
    }
    assert.equal(await page.evaluate(()=>HTMLScriptElement.supports('speculationrules')),true,
      'This check requires a Chromium version with Speculation Rules support.');
    assert.match(header,/^"\/speculation-rules\/document\.[a-f0-9]{64}\.json"$/,
      'The response must declare one fingerprinted same-origin rules URL.');
    const url=new URL(JSON.parse(header),href).href,end=performance.now()+timeout;
    let ruleSet,received;
    // A debug-page fetch is not acceptance evidence: match the browser rule's
    // loader and request ID, not just any successful request to the same JSON.
    do {
      ruleSet=rules.find(rule=>rule.loaderId===loader&&rule.url===url);
      received=ruleSet&&responses.get(ruleSet.requestId);
      if(ruleSet&&received)break;
      await setTimeout(50);
    }while(performance.now()<end);
    assert.ok(ruleSet,'Chromium must register the external rules for this document.');
    assert.ok(received,'The browser rules request must produce a response.');
    assert.equal(requests.get(ruleSet.requestId),url,'The registered rules must come from their own browser request.');
    assert.equal(received.status,200,'The browser rules request must return 200.');
    const mime=Object.entries(received.headers).find(([key])=>key.toLowerCase()==='content-type')?.[1]??'';
    assert.match(mime,/^application\/speculationrules\+json(?:\s*;|$)/i,'Rules must use application/speculationrules+json.');
    assert.ok(!ruleSet.errorType&&!ruleSet.errorMessage,'Chromium rejected rules: '+(ruleSet.errorMessage??ruleSet.errorType));
    assert.equal(ruleSet.backendNodeId,undefined,'The rules must be loaded by the response header.');
    const payload=JSON.parse(ruleSet.sourceText);
    assert.ok((payload.prefetch?.length??0)+(payload.prerender?.length??0)>0,'Chromium must receive at least one rule.');
    for(const slot of options.eager?options.eager.split(','):[])assert.ok(payload.prefetch?.some(rule=>
      rule.source==='document'&&rule.eagerness==='eager'&&rule.where?.selector_matches==='a[data-prefetch-slot="'+slot+'"]'),
      'Missing expected eager prefetch slot: '+slot);
    const violations=await page.evaluate(()=>window.__swbanRulesViolations);
    assert.deepEqual(violations,[],'The rules page must have no CSP violations.');
    return {page:options.page??'/',enabled:true,header,url,status:received.status,mime,payload,
      ruleSet:{id:ruleSet.id,loaderId:ruleSet.loaderId,requestId:ruleSet.requestId},violations};
  }finally{await session.detach();}
}
