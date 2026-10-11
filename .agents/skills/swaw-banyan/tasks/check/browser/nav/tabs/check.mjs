import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';

export async function check({page,context,baseUrl,options}) {
  const response=await page.goto(baseUrl+options.page,{waitUntil:'load'});
  assert.ok(response?.ok(),'Link page must return a successful response.');await waitForBrowse(page);await afterPaint(page);
  const links=page.locator(options.selector),count=await links.count();
  assert.ok(count>0,'The selector must match at least one new-tab anchor.');
  const original=page.url(),history=await page.evaluate(()=>history.length),results=[];
  const marker=await page.evaluate(()=>window.__swbanTabSource=crypto.randomUUID());
  for(let index=0;index<count;index++) {
    const link=links.nth(index),state=await link.evaluate(node=>({tag:node.tagName,href:node.href,target:node.getAttribute('target'),download:node.hasAttribute('download')}));
    assert.equal(state.tag,'A','New-tab checks require native anchors.');
    assert.equal(state.target,'_blank','Selected anchors must target a new tab.');
    assert.equal(state.download,false,'Selected anchors must navigate, not download.');
    const destination=new URL(state.href);assert.ok(['http:','https:'].includes(destination.protocol),'New-tab checks require HTTP(S) destinations.');
    const requestUrl=new URL(destination);requestUrl.hash='';
    // Keep the native click while replacing its destination response locally.
    const respond=route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Link destination</title>'});
    await context.route(requestUrl.href,respond);let opened;
    try {
      [opened]=await Promise.all([page.waitForEvent('popup'),link.click()]);
      await opened.waitForLoadState('domcontentloaded');
      assert.equal(opened.url(),destination.href,'The new tab must open the selected link destination.');
      assert.equal(await opened.evaluate(()=>window.opener===null),true,'The new tab must not expose its opener.');
      assert.equal(page.url(),original,'Opening a new tab must retain the source page URL.');
      assert.equal(await page.evaluate(()=>history.length),history,'Opening a new tab must retain source history.');
      assert.equal(await page.evaluate(()=>window.__swbanTabSource),marker,'Opening a new tab must retain the source document.');
      results.push({href:destination.href,openerIsolated:true});
    } finally {
      try {if(opened)await opened.close();}finally {await context.unroute(requestUrl.href,respond);}
    }
  }
  return {page:options.page,selector:options.selector,links:results};
}
