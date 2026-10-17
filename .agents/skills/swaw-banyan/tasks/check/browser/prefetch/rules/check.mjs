import assert from 'node:assert/strict';
import {setTimeout} from 'node:timers/promises';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';
import {ruleIssues} from '../../../prefetch/rules/inspect.mjs';

export async function check({page,baseUrl,options}) {
  const expect=options.expect??'inline',timeout=options.timeout??15000,href=new URL(options.page??'/',baseUrl).href;
  assert.ok(expect!=='off'||!options.eager,'--eager cannot be used with --expect off.');
  const session=await page.context().newCDPSession(page),rules=[];
  session.on('Preload.ruleSetUpdated',event=>rules.push(event.ruleSet));
  await page.addInitScript(()=>{
    window.__swbanRulesViolations=[];
    document.addEventListener('securitypolicyviolation',event=>window.__swbanRulesViolations.push({
      directive:event.effectiveDirective,blockedURI:event.blockedURI,disposition:event.disposition
    }));
  });
  try {
    await session.send('Preload.enable');
    const response=await page.goto(href,{waitUntil:'load'});
    assert.ok(response?.ok(),'The rules page must return a successful response.');
    await waitForBrowse(page);await afterPaint(page);
    assert.equal(page.url(),href,'Rule checks must preserve the requested page URL.');
    assert.equal(response.headers()['speculation-rules']??'','','Inline rules must not also use a response header.');
    const {frameTree}=await session.send('Page.getFrameTree'),loader=frameTree.frame.loaderId;
    const inline=page.locator('script[type="speculationrules"]');
    if(expect==='off') {
      assert.equal(await inline.count(),0,'Off mode must not declare inline speculationrules.');
      assert.deepEqual(rules.filter(rule=>rule.loaderId===loader),[],'Off mode must not register browser rules.');
      return {page:options.page??'/',enabled:false};
    }
    assert.equal(await page.evaluate(()=>HTMLScriptElement.supports('speculationrules')),true,
      'This check requires a Chromium version with Speculation Rules support.');
    assert.equal(await inline.count(),1,'The page must declare one inline speculation rules document.');
    assert.equal(await page.locator('#site-speculation-rules').count(),1,'Missing generated speculation rules document.');
    const source=await inline.textContent(),end=performance.now()+timeout;
    let ruleSet;
    do {
      ruleSet=rules.find(rule=>rule.loaderId===loader&&rule.sourceText===source);
      if(ruleSet)break;
      await setTimeout(50);
    }while(performance.now()<end);
    assert.ok(ruleSet,'Chromium must register the inline rules for this document.');
    assert.ok(!ruleSet.errorType&&!ruleSet.errorMessage,'Chromium rejected rules: '+(ruleSet.errorMessage??ruleSet.errorType));
    assert.ok(ruleSet.backendNodeId,'The accepted rules must come from the inline script node.');
    const payload=JSON.parse(ruleSet.sourceText);
    assert.deepEqual(ruleIssues(payload),[],'The inline document must use valid shared rules.');
    const selectors=options.eager?await page.locator('#site-prefetch-rules').evaluate(node=>JSON.parse(node.textContent)):null;
    for(const id of options.eager?options.eager.split(','):[]) {
      const selector=selectors.prefetch.find(entry=>entry.id===id)?.selector;
      assert.ok(selector&&payload.prefetch?.some(rule=>rule.source==='document'&&rule.eagerness==='eager'&&
        rule.where?.and?.some(condition=>condition.selector_matches===selector)),
        'Missing expected eager prefetch rule: '+id);
    }
    const violations=await page.evaluate(()=>window.__swbanRulesViolations);
    assert.deepEqual(violations,[],'The rules page must have no CSP violations.');
    return {page:options.page??'/',enabled:true,payload,
      ruleSet:{id:ruleSet.id,loaderId:ruleSet.loaderId,backendNodeId:ruleSet.backendNodeId},violations};
  }finally{await session.detach();}
}
