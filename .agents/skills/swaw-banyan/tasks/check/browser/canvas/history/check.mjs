import assert from 'node:assert/strict';
import {openArticle,openAside} from '../../aside/_shared/page.mjs';
import {activate,afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';
import {panCanvas,waitForCanvasX} from '../_shared/state.mjs';

const position=page=>page.evaluate(()=>({x:window.visualViewport?.pageLeft??scrollX,y:document.querySelector('.page-content').scrollTop}));
async function pan(page,fraction) {
  const left=await page.evaluate(fraction=>{
    const doc=document.scrollingElement,main=document.querySelector('.page-content');
    main.scrollTop=Math.round((main.scrollHeight-main.clientHeight)*fraction);
    return Math.round((doc.scrollWidth-(window.visualViewport?.width??doc.clientWidth))*fraction);
  },fraction);
  await panCanvas(page,left);await afterPaint(page);
  const state=await position(page);
  assert.ok(state.x>0&&state.y>0,'History checks need articles that scroll horizontally and vertically at 390 by 300 pixels.');
  return state;
}
async function restored(page,expected,label) {
  await waitForBrowse(page);
  await waitForCanvasX(page,expected.x,label);
  assert.ok(Math.abs((await position(page)).x-expected.x)<=1,label);
}

export async function check({page,baseUrl,options}) {
  assert.notEqual(options.page,options.next,'--page and --next must select different article URLs.');
  const touch=await page.evaluate(()=>matchMedia('(pointer:coarse)').matches);
  await page.setViewportSize({width:390,height:300});
  await openArticle(page,baseUrl+options.page);
  assert.equal(await page.evaluate(()=>history.scrollRestoration),'auto','The browser must own history scroll restoration.');
  const first=await pan(page,0.65);
  await openArticle(page,baseUrl+options.next);const second=await pan(page,0.2);
  await page.goBack();await restored(page,first,'Back must restore the native horizontal position.');
  await page.goForward();await restored(page,second,'Forward must restore the next article position.');
  await page.reload();await restored(page,second,'Reload must preserve the native horizontal position.');
  const ends=[];
  for(const [width,expanded] of [[390,false],[390,true],[1440,false],[1440,true]]) {
    await page.setViewportSize({width,height:300});
    if(expanded)await openAside(page,touch);
    else if(await page.locator('#document-aside-toggle').getAttribute('aria-expanded')==='true')await activate(page,page.locator('#document-aside-close'),touch);
    await afterPaint(page);
    if(width===390&&expanded)assert.ok(await page.locator('.reading-group').evaluate(node=>node.getBoundingClientRect().width>document.querySelector('.page').clientWidth+1),
      'The expanded mobile reading group must exceed the canvas width.');
    const end=await pan(page,1),label=`${width}px canvas with ${expanded?'expanded':'collapsed'} metadata`;
    // WebKit reload uses the scroll snapshot saved by history traversal.
    await openArticle(page,baseUrl+options.page);const away=await pan(page,1);
    await page.goBack();await restored(page,end,`Back must retain the right edge of the ${label}.`);
    await page.goForward();await restored(page,away,`Forward must retain the right edge of the ${label}.`);
    await page.goBack();await restored(page,end,`Back must return to the right edge of the ${label}.`);
    await page.reload();await restored(page,end,`Reload must retain the right edge of the ${label}.`);
    assert.equal(await page.locator('#document-aside-toggle').getAttribute('aria-expanded'),String(expanded),'History must retain the aside preference.');
    ends.push({width,expanded,...end});
  }
  await page.setViewportSize({width:390,height:300});await afterPaint(page);
  assert.equal(await page.evaluate(()=>history.scrollRestoration),'auto','The browser must own history scroll restoration.');
  const sort=page.locator('[data-slot=breadcrumb] [data-collection-sort-toggle="true"]').first();
  assert.equal(await sort.count(),1,'The next article needs a breadcrumb sort control; include its source context.');
  await sort.scrollIntoViewIfNeeded();await sort.focus();await afterPaint(page);
  const beforeSort=await position(page),beforeUrl=page.url();
  await page.keyboard.press('Enter');await page.waitForURL(url=>url.href!==beforeUrl);
  await restored(page,beforeSort,'In-place sorting must preserve the visible canvas position.');
  await openArticle(page,baseUrl+options.page);await afterPaint(page);
  assert.equal((await position(page)).y,0,'A new article visit must start at the top.');
  return {page:options.page,next:options.next,first,second,ends,beforeSort};
}
