import assert from 'node:assert/strict';
import {readRootState} from '../../nav/_shared/root.mjs';
import {afterPaint} from '../../_shared/viewport.mjs';

// Positive inline offsets let both reading directions use the same assertions.
export const readCanvas=async page=>({...await page.evaluate(()=>{
  const view=window.visualViewport,rtl=getComputedStyle(document.documentElement).direction==='rtl';
  const direction=rtl?-1:1,viewport=view?.width||innerWidth,rect=node=>{
    const box=node.getBoundingClientRect();
    const x=box.x-(view?.offsetLeft||0),right=box.right-(view?.offsetLeft||0);
    return {x:rtl?viewport-right:x,y:box.y-(view?.offsetTop||0),width:box.width,right:rtl?viewport-x:right};
  };
  const main=document.querySelector('#main'),nav=document.querySelector('[data-root-navigation]'),content=document.querySelector('.page-content');
  const path=document.querySelector('[data-slot=breadcrumb]'),columns=[...document.querySelectorAll('[data-slot=breadcrumb] [data-collection-column]')];
  const probe=window.__swbanCanvasStartup;
  if(probe?.shifts)for(const entry of probe.shifts.takeRecords())if(!entry.hadRecentInput)probe.layoutShift+=entry.value;
  const collection=main.classList.contains('slot-main--collection');
  const pathContent=columns.map(column=>{
    const header=column.querySelector('.list-header--path'),label=header?.querySelector('.path-column-label');
    const separator=header?.querySelector('.path-column-separator'),sort=header?.querySelector('.path-column-sort');
    return {href:column.dataset.breadcrumbCollectionHref,
      rows:[...column.querySelectorAll('[data-list-entry]')].map(link=>({path:new URL(link.href).pathname,text:link.textContent.trim()})),
      header:label&&separator&&sort?{label:label.textContent.trim(),
        labelToSeparator:rect(separator).x-rect(label).right,
        separatorToSort:rect(sort).x-rect(separator).right}:null};
  });
  return {direction,main:rect(main),nav:rect(nav),columns:columns.map(rect),mainDocumentX:rect(main).x+direction*(view?.pageLeft??scrollX),
    canvasOffsetX:direction*(view?.pageLeft??scrollX)||0,canvasOffsetY:view?.pageTop??scrollY,readingY:content.scrollTop,
    viewport:view?.width||innerWidth,maxX:document.scrollingElement.scrollWidth-(view?.width||innerWidth),
    directoryMetadata:[...document.querySelectorAll('.document-meta__row--path')].map(node=>({ariaLabel:node.getAttribute('aria-label'),html:node.innerHTML})),
    entryPending:document.documentElement.hasAttribute('data-entry-breadcrumb-pending'),
    sortPending:document.documentElement.hasAttribute('data-breadcrumb-sort-pending'),collection,pathContent,
    layoutShift:probe?.layoutShift??null,
    parsed:probe?.parsed??null,firstFrameX:probe?.firstFrameX==null?null:direction*probe.firstFrameX,domContentLoaded:probe?.domContentLoaded??null,
    reservedColumnsRetained:!!probe?.nav&&probe.nav===path&&probe.nav.isConnected&&probe.columns.length===columns.length
      &&probe.columns.every((column,index)=>column===columns[index]&&column.isConnected),
    pathAccessible:!!path&&!path.hasAttribute('aria-hidden')&&path.getAttribute('aria-label')==='Breadcrumb'};
}),root:await readRootState(page)});

export async function panCanvas(page,left) {
  await page.locator('.page-content').evaluate((column,left)=>{
    const previous=column.style.scrollMarginInlineStart;
    const rtl=getComputedStyle(document.documentElement).direction==='rtl',box=column.getBoundingClientRect();
    column.style.scrollMarginInlineStart=(rtl?document.documentElement.clientWidth-box.right-scrollX:box.left+scrollX)-left+'px';
    column.scrollIntoView({inline:'start',block:'nearest',behavior:'instant'});
    column.style.scrollMarginInlineStart=previous;
  },left);
}

export async function assertCanvasEnd(page) {
  const scripting=await page.evaluate(()=>{
    const direction=getComputedStyle(document.documentElement).direction==='rtl'?-1:1;
    let scroller=document.querySelector('.page-content').parentElement;
    while(scroller&&scroller!==document.scrollingElement
      &&!(/auto|scroll/.test(getComputedStyle(scroller).overflowX)&&scroller.scrollWidth>scroller.clientWidth+1))scroller=scroller.parentElement;
    scroller??=document.scrollingElement;
    if(scroller===document.scrollingElement)scrollTo({left:direction*scroller.scrollWidth,top:0,behavior:'instant'});
    else scroller.scrollTo({left:direction*scroller.scrollWidth,top:0,behavior:'instant'});
    return matchMedia('(scripting: enabled)').matches;
  });
  if(scripting)await afterPaint(page);
  const state=await page.evaluate(()=>{
    const columns=[...document.querySelectorAll('.page-content,.document-aside')].filter(node=>node.getClientRects().length);
    const first=columns[0].getBoundingClientRect(),last=columns.at(-1).getBoundingClientRect(),view=window.visualViewport;
    const group=document.querySelector('.reading-group').getBoundingClientRect();
    const style=getComputedStyle(document.querySelector('.page-shell')),offset=view?.offsetLeft??0;
    const rtl=style.direction==='rtl',viewport=view?.width??innerWidth;
    return {mainLeft:rtl?viewport-first.right+offset:first.left-offset,lastRight:rtl?viewport-last.left+offset:last.right-offset,groupWidth:rtl?first.right-last.left:last.right-first.left,
      canvasWidth:document.querySelector('.page').getBoundingClientRect().width,viewport:view?.width??innerWidth,
      edge:parseFloat(getComputedStyle(document.body).paddingInlineStart),padding:parseFloat(style.paddingInlineEnd),
      tail:rtl?last.left-group.left:group.right-last.right};
  });
  assert.ok(Math.abs(state.tail-Math.max(0,state.canvasWidth-state.groupWidth))<=1,'Tail space must fill only the unused reading-group width.');
  if(state.groupWidth<=state.canvasWidth+1)assert.ok(Math.abs(state.mainLeft-state.edge)<=1,
    'At the canvas end, the final reading group must align with the page edge: '+JSON.stringify(state));
  else {
    assert.ok(Math.abs(state.tail)<=1,'An oversized reading group must have no tail space.');
    assert.ok(Math.abs(state.lastRight-state.viewport+state.padding)<=1,'At the canvas end, the last column must reach the inline-end page edge.');
  }
  return state;
}

export async function waitForCanvasX(page,x,label='Canvas position') {
  try {await page.waitForFunction(x=>Math.abs((window.visualViewport?.pageLeft??scrollX)*(getComputedStyle(document.documentElement).direction==='rtl'?-1:1)-x)<=1,x);}
  catch(error) {
    const actual=await page.evaluate(()=>({x:window.visualViewport?.pageLeft??scrollX,scrollX,offset:window.visualViewport?.offsetLeft}));
    throw new Error(label+': expected '+x+', actual '+JSON.stringify(actual)+'. '+error.message);
  }
}
