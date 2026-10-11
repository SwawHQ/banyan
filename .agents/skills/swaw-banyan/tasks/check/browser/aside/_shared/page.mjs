import assert from 'node:assert/strict';
import {activate,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';

export async function openArticle(page,url) {
  const response=await page.goto(url,{waitUntil:'load'});
  assert.ok(response?.ok(),'Article must return a successful response.');
  await waitForBrowse(page);
  assert.equal(await page.locator('#document-aside-toggle').count(),1,'Article must have one aside toggle.');
  assert.equal(await page.locator('#document-aside').count(),1,'Article must have one document aside.');
}

export async function openAside(page,touch=false) {
  const toggle=page.locator('#document-aside-toggle');
  if(await toggle.getAttribute('aria-expanded')==='false')await activate(page,toggle,touch);
  await page.locator('#document-aside').waitFor({state:'visible'});
}

export const readingState = page => page.evaluate(()=>{
  const content=document.querySelector('.page-content'),main=document.getElementById('main').getBoundingClientRect(),view=window.visualViewport;
  return {width:main.width,height:content.scrollHeight,y:content.scrollTop,left:main.left-(view?.offsetLeft||0),
    right:main.right-(view?.offsetLeft||0),x:view?.pageLeft??scrollX,canvasWidth:document.scrollingElement.scrollWidth,viewport:view?.width||innerWidth};
});
