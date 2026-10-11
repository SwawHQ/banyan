import assert from 'node:assert/strict';
import {openArticle} from '../../aside/_shared/page.mjs';
import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';

const position=page=>page.evaluate(()=>({x:scrollX,y:document.querySelector('.page-content').scrollTop}));
async function pan(page,fraction) {
  await page.evaluate(fraction=>{
    const doc=document.scrollingElement,main=document.querySelector('.page-content');
    scrollTo({left:Math.round((doc.scrollWidth-doc.clientWidth)*fraction),top:0,behavior:'instant'});
    main.scrollTop=Math.round((main.scrollHeight-main.clientHeight)*fraction);
  },fraction);await afterPaint(page);
  const state=await position(page);
  assert.ok(state.x>0&&state.y>0,'History checks need articles that scroll horizontally and vertically at 390 by 300 pixels.');
  return state;
}
async function restored(page,expected,label) {
  await waitForBrowse(page);
  await page.waitForFunction(x=>Math.abs(scrollX-x)<=1,expected.x);
  assert.ok(Math.abs((await position(page)).x-expected.x)<=1,label);
}

export async function check({page,baseUrl,options}) {
  assert.notEqual(options.page,options.next,'--page and --next must select different article URLs.');
  await page.setViewportSize({width:390,height:300});
  await openArticle(page,baseUrl+options.page);
  assert.equal(await page.evaluate(()=>history.scrollRestoration),'auto','The browser must own history scroll restoration.');
  const first=await pan(page,0.65);
  await openArticle(page,baseUrl+options.next);const second=await pan(page,0.2);
  await page.goBack();await restored(page,first,'Back must restore the native horizontal position.');
  await page.goForward();await restored(page,second,'Forward must restore the next article position.');
  await page.reload();await restored(page,second,'Reload must preserve the native horizontal position.');
  assert.equal(await page.evaluate(()=>history.scrollRestoration),'auto','The browser must own history scroll restoration.');
  const sort=page.locator('.slot-breadcrumb [data-collection-sort-toggle="true"]').first();
  assert.equal(await sort.count(),1,'The next article needs a breadcrumb sort control; include its source context.');
  await sort.scrollIntoViewIfNeeded();await sort.focus();await afterPaint(page);
  const beforeSort=await position(page),beforeUrl=page.url();
  await page.keyboard.press('Enter');await page.waitForURL(url=>url.href!==beforeUrl);
  await restored(page,beforeSort,'In-place sorting must preserve the visible canvas position.');
  await openArticle(page,baseUrl+options.page);await afterPaint(page);
  assert.equal((await position(page)).y,0,'A new article visit must start at the top.');
  return {page:options.page,next:options.next,first,second,beforeSort};
}
