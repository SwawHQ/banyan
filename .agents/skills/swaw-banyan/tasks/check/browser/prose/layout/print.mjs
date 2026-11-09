import assert from 'node:assert/strict';
import {tableSamples} from './tables.mjs';

export async function checkPrint(page) {
  const viewport=page.viewportSize();
  const rootSize=await page.evaluate(()=>document.documentElement.style.fontSize);
  const original=await page.locator('.prose').evaluate(node=>({html:node.innerHTML,style:node.getAttribute('style')}));
  const text='long_unbroken_value_'.repeat(30),results=[];
  try {
    await page.locator('.prose').evaluate((node,{text,tables})=>{
      node.removeAttribute('style');
      node.innerHTML='<h2>Print layout</h2><pre><code>'+text+'</code></pre>'
        +'<div class="highlight"><pre class="chroma"><code><span class="line"><span class="ln">1</span><span class="cl">'+text+'</span></span></code></pre></div>'
        +tables.replace('const value = 1;',text).replace('ordinary</td>',text+'</td>');
    },{text,tables:tableSamples});
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('.skip-link').isVisible(),false,'Print must hide the screen-only skip link.');
    for(const fontSize of [15,20])for(const width of [718,1050]) {
      await page.setViewportSize({width,height:1000});
      await page.evaluate(size=>document.documentElement.style.fontSize=size+'px',fontSize);
      const state=await page.evaluate(()=>{
        const prose=document.querySelector('.prose'),main=document.querySelector('.page-content');
        const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};};
        return {width:innerWidth,fontSize:getComputedStyle(prose).fontSize,main:rect(main),prose:rect(prose),
          blocks:[...prose.querySelectorAll('pre,code,table,.highlight')].map(node=>({tag:node.tagName,
            ...rect(node),overflow:node.scrollWidth-node.clientWidth})),
          columns:[...document.querySelectorAll('.page-column')].map(rect)};
      });
      for(const box of [state.main,state.prose,...state.columns,...state.blocks])assert.ok(box.left>=-1&&box.right<=width+1,
        'Printed contents must fit the page width: '+JSON.stringify({width,box}));
      for(const block of state.blocks)assert.ok(block.overflow<=1,
        'Printed code and tables must wrap without clipping: '+JSON.stringify(block));
      results.push(state);
    }
    return results;
  } finally {
    await page.emulateMedia({media:'screen'});
    await page.evaluate(size=>document.documentElement.style.fontSize=size,rootSize);
    if(viewport)await page.setViewportSize(viewport);
    await page.locator('.prose').evaluate((node,original)=>{
      node.innerHTML=original.html;
      if(original.style===null)node.removeAttribute('style');else node.setAttribute('style',original.style);
    },original);
  }
}
