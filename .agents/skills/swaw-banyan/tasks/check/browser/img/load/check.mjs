import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';

export async function check({page,baseUrl,options}) {
  const response=await page.goto(baseUrl+options.page,{waitUntil:'load'});
  assert.ok(response?.ok(),'Image page must return a successful response.');await waitForBrowse(page);await afterPaint(page);
  const images=page.locator(options.selector),count=await images.count();
  assert.ok(count>0,'The selector must match at least one displayed image.');const results=[];
  for(let index=0;index<count;index++) {
    const image=images.nth(index);
    assert.equal(await image.evaluate(node=>node.tagName),'IMG','Image checks require img elements.');
    assert.ok(await image.isVisible(),'Selected images must be visible.');
    await image.scrollIntoViewIfNeeded();
    try {await image.evaluate(node=>node.decode());}
    catch(error){throw new Error('Image must decode: '+await image.getAttribute('src')+'. '+error.message);}
    const state=await image.evaluate(node=>{
      const box=node.getBoundingClientRect();return {src:node.currentSrc,link:node.closest('a')?.href??null,
        naturalWidth:node.naturalWidth,naturalHeight:node.naturalHeight,width:box.width,height:box.height};
    });
    assert.ok(state.naturalWidth>0&&state.naturalHeight>0,'Decoded images must have intrinsic dimensions.');
    assert.ok(state.width>0&&state.height>0,'Displayed images must have rendered dimensions.');results.push(state);
  }
  return {page:options.page,selector:options.selector,images:results};
}
