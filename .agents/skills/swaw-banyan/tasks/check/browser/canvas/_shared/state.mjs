import {readRootState} from '../../nav/_shared/root.mjs';

export const readCanvas=async page=>({...await page.evaluate(()=>{
  const view=window.visualViewport,rect=node=>{
    const box=node.getBoundingClientRect();
    return {x:box.x-(view?.offsetLeft||0),y:box.y-(view?.offsetTop||0),width:box.width,right:box.right-(view?.offsetLeft||0)};
  };
  const main=document.querySelector('#main'),nav=document.querySelector('[data-root-navigation]'),content=document.querySelector('.page-content');
  const path=document.querySelector('.slot-breadcrumb .path-navigation'),columns=[...document.querySelectorAll('.slot-breadcrumb [data-collection-column]')];
  const probe=window.__swbanCanvasStartup;
  if(probe?.shifts)for(const entry of probe.shifts.takeRecords())if(!entry.hadRecentInput)probe.layoutShift+=entry.value;
  const collection=main.classList.contains('slot-main--collection');
  const pathContent=columns.map(column=>{
    const header=column.querySelector('.collection-header--path'),label=header?.querySelector('.collection-column-label');
    const separator=header?.querySelector('.collection-column-separator'),sort=header?.querySelector('.collection-column-sort');
    return {href:column.dataset.breadcrumbCollectionHref,
      rows:[...column.querySelectorAll('[data-collection-entry]')].map(link=>({path:new URL(link.href).pathname,text:link.textContent.trim()})),
      header:label&&separator&&sort?{label:label.textContent.trim(),
        labelToSeparator:separator.getBoundingClientRect().left-label.getBoundingClientRect().right,
        separatorToSort:sort.getBoundingClientRect().left-separator.getBoundingClientRect().right}:null};
  });
  return {main:rect(main),nav:rect(nav),columns:columns.map(rect),mainDocumentX:main.getBoundingClientRect().x+scrollX,
    canvasOffsetX:view?.pageLeft??scrollX,canvasOffsetY:view?.pageTop??scrollY,readingY:content.scrollTop,
    viewport:view?.width||innerWidth,maxX:document.scrollingElement.scrollWidth-(view?.width||innerWidth),
    directoryMetadata:[...document.querySelectorAll('.document-meta__row--path')].map(node=>({ariaLabel:node.getAttribute('aria-label'),html:node.innerHTML})),
    entryPending:document.documentElement.hasAttribute('data-entry-breadcrumb-pending'),
    sortPending:document.documentElement.hasAttribute('data-breadcrumb-sort-pending'),collection,pathContent,
    layoutShift:probe?.layoutShift??null,
    parsed:probe?.parsed??null,firstFrameX:probe?.firstFrameX??null,domContentLoaded:probe?.domContentLoaded??null,
    reservedColumnsRetained:!!probe?.nav&&probe.nav===path&&probe.nav.isConnected&&probe.columns.length===columns.length
      &&probe.columns.every((column,index)=>column===columns[index]&&column.isConnected),
    pathAccessible:!!path&&!path.hasAttribute('aria-hidden')&&path.getAttribute('aria-label')==='Breadcrumb'};
}),root:await readRootState(page)});

export async function panCanvas(page,left) {
  await page.locator('.page-content').evaluate((column,left)=>{
    const previous=column.style.scrollMarginInlineStart;
    column.style.scrollMarginInlineStart=column.getBoundingClientRect().left+scrollX-left+'px';
    column.scrollIntoView({inline:'start',block:'nearest',behavior:'instant'});
    column.style.scrollMarginInlineStart=previous;
  },left);
}

export async function waitForCanvasX(page,x,label='Canvas position') {
  try {await page.waitForFunction(x=>Math.abs((window.visualViewport?.pageLeft??scrollX)-x)<=1,x);}
  catch(error) {
    const actual=await page.evaluate(()=>({x:window.visualViewport?.pageLeft??scrollX,scrollX,offset:window.visualViewport?.offsetLeft}));
    throw new Error(label+': expected '+x+', actual '+JSON.stringify(actual)+'. '+error.message);
  }
}
