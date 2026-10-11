import assert from 'node:assert/strict';
import {openArticle} from '../_shared/page.mjs';

export async function check({page,baseUrl,options}) {
  await openArticle(page,baseUrl+options.page);await page.emulateMedia({media:'print'});
  try {
    assert.equal(await page.locator('#document-aside').isVisible(),true,'Print must retain document metadata.');
    for(const selector of ['#document-aside-toggle','#document-aside-close','.document-toc'])
      assert.equal(await page.locator(selector).isVisible(),false,'Print must hide screen-only controls: '+selector);
    const state=await page.evaluate(()=>{
      const main=document.querySelector('.page-content'),aside=document.querySelector('#document-aside');
      return {below:aside.getBoundingClientRect().top>=main.getBoundingClientRect().bottom,
        overflow:getComputedStyle(aside).overflowY,clipped:aside.scrollHeight>aside.clientHeight+1||main.scrollHeight>main.clientHeight+1};
    });
    assert.ok(state.below&&state.overflow==='visible'&&!state.clipped,'Print must put the aside below the full article without clipping.');
    return {page:options.page,...state};
  } finally {await page.emulateMedia({media:'screen'});}
}
