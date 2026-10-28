import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';
import {openAside} from '../../aside/_shared/page.mjs';

const columns='.page-rail,.path-column,.page-content,.document-aside:not([hidden])';
const read=page=>page.evaluate(selector=>{
  const doc=document.scrollingElement,main=document.querySelector('.page-content'),meta=document.querySelector('.slot-meta');
  return {direction:getComputedStyle(doc).direction==='rtl'?-1:1,documentHeight:doc.scrollHeight,viewportHeight:doc.clientHeight,rootY:scrollY,
    x:scrollX*(getComputedStyle(doc).direction==='rtl'?-1:1)||0,maxX:doc.scrollWidth-doc.clientWidth,
    readingY:main.scrollTop,metaInContent:!!meta&&main.contains(meta),metaInAside:!!meta&&!!meta.closest('.document-aside'),metadata:!!meta,
    columns:[...document.querySelectorAll(selector)].filter(node=>node.getClientRects().length).map(node=>({className:node.className,
      x:node.scrollLeft,y:node.scrollTop,maxY:node.scrollHeight-node.clientHeight,clientWidth:node.clientWidth,
      scrollWidth:node.scrollWidth,bottom:node.getBoundingClientRect().bottom}))};
},columns);

export async function check({page,baseUrl,options}) {
  const cases=[];
  for(const width of options.widths.split(',').map(Number)) {
    await page.setViewportSize({width,height:300});
    await page.goto('about:blank');
    const response=await page.goto(baseUrl+options.page,{waitUntil:'load'});
    assert.ok(response?.ok(),'Page must return a successful response.');await waitForBrowse(page);
    assert.equal(await page.locator('.page-content').count(),1,'Page must have one reading column.');
    if(await page.locator('#document-aside-toggle').count())await openAside(page);
    await page.evaluate(selector=>{
      scrollTo({left:0,top:0,behavior:'instant'});
      for(const node of document.querySelectorAll(selector))node.scrollTop=0;
    },columns);await afterPaint(page);
    const initial=await read(page);
    assert.ok(initial.columns.some(column=>column.maxY>0),'Choose a page with overflowing columns at 300 pixels high.');
    assert.equal(initial.documentHeight,initial.viewportHeight,'Offscreen columns must not extend the document vertically.');
    assert.equal(initial.rootY,0,'The document must not scroll vertically.');
    if(initial.metadata)assert.ok(!initial.metaInContent&&initial.metaInAside,'Article metadata must belong to the aside scroller.');
    for(let index=0;index<initial.columns.length;index++) {
      const before=await read(page);
      await page.evaluate(({selector,index})=>{
        const nodes=[...document.querySelectorAll(selector)].filter(node=>node.getClientRects().length);
        nodes[index].scrollTop=nodes[index].scrollHeight;
      },{selector:columns,index});await afterPaint(page);
      const after=await read(page);
      assert.equal(after.columns.length,before.columns.length,'Scrolling must retain the columns.');
      assert.ok(Math.abs(after.columns[index].y-after.columns[index].maxY)<=1,'Each overflowing column must reach its own bottom.');
      assert.ok(after.columns.every((column,i)=>i===index||column.y===before.columns[i].y),
        'Each column must scroll without changing another column.');
      assert.equal(after.x,before.x,'Vertical column scrolling must preserve the canvas position.');
      assert.equal(after.rootY,0,'Column scrolling must not move the document vertically.');
    }
    const state=await read(page);
    assert.ok(state.columns.every(column=>column.x===0&&column.scrollWidth<=column.clientWidth+1),
      'Columns must not create inner horizontal scrollbars.');
    assert.ok(state.columns.every(column=>column.bottom<=state.viewportHeight+1),'Columns must stay within the viewport height.');
    await page.evaluate(x=>scrollTo({left:x,top:0,behavior:'instant'}),state.maxX*state.direction);await afterPaint(page);
    const panned=await read(page);
    assert.ok(Math.abs(panned.x-state.maxX)<=1,'The document must own horizontal canvas scrolling.');
    assert.ok(panned.columns.every((column,i)=>column.y===state.columns[i].y&&column.x===0),
      'Horizontal panning must preserve each column reading position.');
    assert.equal(panned.rootY,0,'Horizontal panning must not scroll the document vertically.');
    cases.push({width,...state,pannedX:panned.x});
  }
  assert.ok(cases.some(state=>state.pannedX>0),'Choose a page and widths that exercise horizontal canvas panning.');
  return {page:options.page,cases};
}
