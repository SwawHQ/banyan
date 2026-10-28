import assert from 'node:assert/strict';
import {openArticle} from '../_shared/page.mjs';

export async function check({page,baseUrl,options}) {
  await openArticle(page,baseUrl+options.page);await page.emulateMedia({media:'print'});
  try {
    assert.equal(await page.locator('#document-aside').isVisible(),true,'Print must retain document metadata.');
    for(const selector of ['#document-aside-toggle','#document-aside-close','.document-toc'])
      assert.equal(await page.locator(selector).isVisible(),false,'Print must hide screen-only controls: '+selector);
    const state=await page.evaluate(()=>{
      const main=document.querySelector('.page-content'),aside=document.querySelector('#document-aside'),rail=document.querySelector('.page-rail');
      const rtl=getComputedStyle(document.documentElement).direction==='rtl';
      return {below:aside.getBoundingClientRect().top>=main.getBoundingClientRect().bottom,
        mainLeft:rtl?-main.getBoundingClientRect().right:main.getBoundingClientRect().left,
        asideLeft:rtl?-aside.getBoundingClientRect().right:aside.getBoundingClientRect().left,
        railRight:rtl?-rail.getBoundingClientRect().left:rail.getBoundingClientRect().right,
        gap:parseFloat(getComputedStyle(document.querySelector('.page-shell')).columnGap),
        overflow:getComputedStyle(aside).overflowY,clipped:aside.scrollHeight>aside.clientHeight+1||main.scrollHeight>main.clientHeight+1};
    });
    assert.ok(state.below&&state.overflow==='visible'&&!state.clipped,'Print must put the aside below the full article without clipping.');
    assert.ok(Math.abs(state.mainLeft-state.asideLeft)<=1&&Math.abs(state.mainLeft-state.railRight-state.gap)<=1,
      'Print must align main and aside in the column after the root rail.');
    return {page:options.page,...state};
  } finally {await page.emulateMedia({media:'screen'});}
}
