import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';

export async function check({page,baseUrl,options}) {
  const results=[];
  for(const width of options.widths.split(',').map(Number)) {
    await page.setViewportSize({width,height:options.height??900});
    await page.goto('about:blank');
    const response=await page.goto(baseUrl+options.page,{waitUntil:'load'});
    assert.ok(response?.ok(),'Page must return a successful response.');await waitForBrowse(page);await afterPaint(page);
    const state=await page.evaluate(()=>{
      const view=window.visualViewport,rect=node=>{
        const box=node.getBoundingClientRect();return {x:box.x-(view?.offsetLeft||0),y:box.y-(view?.offsetTop||0),width:box.width,right:box.right-(view?.offsetLeft||0),height:box.height};
      };
      const nav=document.querySelector('[data-root-navigation]'),main=document.querySelector('#main'),prose=document.querySelector('.prose'),footer=document.querySelector('.slot-footer');
      const columns=[...document.querySelectorAll('.slot-breadcrumb [data-collection-column]')];
      const probe=document.createElement('div');
      probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;block-size:0;padding:0;border:0';
      document.querySelector('.page').append(probe);
      const measure=value=>{probe.style.inlineSize=value;return probe.getBoundingClientRect().width;};
      const declared={column:measure('var(--navigation-column-inline)'),gap:measure('var(--page-shell-gap-inline)'),main:measure('var(--main-column-inline)')};
      probe.remove();
      const tracks=[nav,...columns,main].map(rect),path=document.querySelector('.path-columns');
      return {main:rect(main),nav:rect(nav),columns:columns.map(rect),columnLinks:columns.map(node=>node.querySelectorAll('[data-collection-entry][href]').length),
        declared,gaps:tracks.slice(1).map((track,index)=>track.x-tracks[index].right),
        pathOverflow:path?path.scrollWidth-path.clientWidth:0,clientWidth:document.scrollingElement.clientWidth,
        readingClientWidth:document.querySelector('.page-content').clientWidth,
        plainColumns:columns.every(node=>node.querySelector(':scope > .collection-list.collection-list--path-column')&&!node.querySelector('[aria-expanded],[role="menu"],[hidden]')),
        rootNavigationCount:document.querySelectorAll('[data-root-navigation]').length,
        rootCount:nav.querySelectorAll('[data-root-href]').length,
        rootEntriesVisible:[...nav.querySelectorAll('[data-root-href]')].every(link=>link.getClientRects().length>0&&getComputedStyle(link).visibility==='visible'),
        prose:prose?rect(prose):null,proseOverflow:prose?prose.scrollWidth-prose.clientWidth:0,
        collection:main.classList.contains('slot-main--collection'),footer:footer?rect(footer):null,footerInRail:!footer||!!footer.closest('.page-rail'),
        viewport:view?.width||innerWidth,scrollWidth:document.scrollingElement.scrollWidth,x:view?.pageLeft??scrollX};
    });
    assert.ok(state.rootCount>0,'The page must have root navigation entries.');
    assert.equal(state.rootNavigationCount,1,'The page must have one root navigation.');
    assert.equal(state.rootEntriesVisible,true,'Every root entry must remain visible.');
    assert.equal(state.plainColumns,true,'Breadcrumb columns must use the shared plain list layout.');
    assert.ok(state.columns.every(column=>Math.abs(column.width-state.nav.width)<=1),'Navigation columns must share a width.');
    assert.ok(state.declared.column>0&&Math.abs(state.nav.width-state.declared.column)<=1,'Navigation width must match --navigation-column-inline.');
    assert.ok(state.pathOverflow<=1,'Breadcrumb columns must not create their own horizontal scroller.');
    assert.ok(state.declared.gap>0&&state.gaps.every(gap=>Math.abs(gap-state.declared.gap)<=.1),'Root, path and main columns must share --page-shell-gap-inline.');
    assert.ok(state.columnLinks.every(count=>count>0),'Each breadcrumb column must have links.');
    assert.ok([state.nav,...state.columns].every(column=>Math.abs(column.y-state.main.y)<=1),'Columns must begin at the same vertical position.');
    assert.equal(state.x,0,'Direct visits must preserve the canvas origin.');
    if(!state.collection)assert.ok(state.main.width<=state.viewport+1,'Reading and settings columns must fit the viewport.');
    const minimumMain=state.collection?state.declared.main:Math.min(state.declared.main,state.readingClientWidth);
    assert.ok(state.declared.main>0&&state.main.width+1>=minimumMain,'Main must not shrink below --main-column-inline within its reading column.');
    if(state.main.right>state.viewport)assert.ok(state.scrollWidth>state.clientWidth,'Canvas overflow must reach the document scroller.');
    if(width<=430)assert.ok(state.scrollWidth>state.viewport&&state.nav.x>=0&&state.nav.right<=state.viewport,'Narrow pages must pan while keeping root navigation visible.');
    if(state.prose)assert.ok(state.prose.width<=state.viewport&&state.proseOverflow<=1,'Prose must fit without horizontal overflow.');
    assert.ok(state.footerInRail,'The footer must remain in the root navigation rail.');
    if(state.footer)assert.ok(Math.abs(state.footer.x-state.nav.x)<=1&&state.footer.y>=state.nav.y+state.nav.height,'The footer must align below root navigation.');
    await page.evaluate(()=>scrollTo({left:0,top:0,behavior:'instant'}));await afterPaint(page);
    const bounds=await page.locator('[data-root-navigation]').boundingBox();
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width,'The canvas origin must reveal the complete root navigation.');
    results.push({width,height:options.height??900,...state});
  }
  assert.ok(results.every(state=>state.columns.length===results[0].columns.length&&state.rootCount===results[0].rootCount),
    'The same page must expose the same navigation at every width.');
  return {page:options.page,cases:results};
}
