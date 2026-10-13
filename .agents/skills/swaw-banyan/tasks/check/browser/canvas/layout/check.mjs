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
      const nav=document.querySelector('[data-root-navigation]'),main=document.querySelector('#main'),content=document.querySelector('.page-content'),prose=document.querySelector('.prose'),footer=document.querySelector('.slot-footer');
      const collection=main.classList.contains('slot-main--collection'),list=collection?main.querySelector('.item-list'):null;
      const inlineSpace=(node,properties)=>properties.reduce((sum,key)=>sum+Number.parseFloat(getComputedStyle(node)[key]),0);
      const columns=[...document.querySelectorAll('[data-slot=breadcrumb] [data-collection-column]')];
      const probe=document.createElement('div');
      probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;block-size:0;padding:0;border:0';
      document.querySelector('.page').append(probe);
      const measure=value=>{probe.style.inlineSize=value;return probe.getBoundingClientRect().width;};
      const declared={column:measure('var(--navigation-column-inline)'),gap:measure('var(--page-shell-gap-inline)'),main:measure('var(--main-column-inline)')};
      if(list){list.append(probe);declared.list=measure('var(--list-inline-size)');}
      probe.remove();
      const tracks=[nav,...columns,main].map(rect),canvas=document.querySelector('.page-shell');
      const scrollColumns=[...document.querySelectorAll('.page-column,.page-rail,.path-column,.page-content,.document-aside')];
      const unifiedCanvas=document.querySelectorAll('.page-shell').length===1&&scrollColumns.every(column=>{
        let parent=column.parentElement;
        while(parent&&parent!==canvas&&getComputedStyle(parent).display==='contents')parent=parent.parentElement;
        return parent===canvas;
      });
      const ancestors=new Set();
      for(const column of scrollColumns) {
        for(let node=column;node&&node!==document.scrollingElement;node=node.parentElement)ancestors.add(node);
      }
      const nestedHorizontalScrollers=[...ancestors].filter(node=>['auto','scroll','hidden'].includes(getComputedStyle(node).overflowX)
        &&node.scrollWidth>node.clientWidth+1).map(node=>node.className);
      return {main:rect(main),nav:rect(nav),columns:columns.map(rect),columnLinks:columns.map(node=>node.querySelectorAll('[data-list-entry][href]').length),
        declared,gaps:tracks.slice(1).map((track,index)=>track.x-tracks[index].right),
        unifiedCanvas,nestedHorizontalScrollers,clientWidth:document.scrollingElement.clientWidth,
        readingClientWidth:content.clientWidth,readingWidth:rect(content).width,
        readingInlineSpace:content.offsetWidth-content.clientWidth+inlineSpace(content,['paddingLeft','paddingRight'])+inlineSpace(main,['marginLeft','marginRight']),
        mainInlineSpace:inlineSpace(main,['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth']),
        list:list?{...rect(list),margins:inlineSpace(list,['marginLeft','marginRight'])}:null,
        plainColumns:columns.every(node=>node.querySelector(':scope > .item-list.item-list--path-column')&&!node.querySelector('[aria-expanded],[role="menu"],[hidden]')),
        sharedColumns:scrollColumns.every(node=>node.classList.contains('page-column')),
        rootNavigationCount:document.querySelectorAll('[data-root-navigation]').length,
        rootCount:nav.querySelectorAll('[data-root-href]').length,
        rootEntriesVisible:[...nav.querySelectorAll('[data-root-href]')].every(link=>link.getClientRects().length>0&&getComputedStyle(link).visibility==='visible'),
        prose:prose?rect(prose):null,proseOverflow:prose?prose.scrollWidth-prose.clientWidth:0,
        collection,footer:footer?rect(footer):null,footerInRail:!footer||!!footer.closest('.page-rail'),
        viewport:view?.width||innerWidth,scrollWidth:document.scrollingElement.scrollWidth,x:view?.pageLeft??scrollX};
    });
    assert.ok(state.rootCount>0,'The page must have root navigation entries.');
    assert.equal(state.rootNavigationCount,1,'The page must have one root navigation.');
    assert.equal(state.rootEntriesVisible,true,'Every root entry must remain visible.');
    assert.equal(state.sharedColumns,true,'Every scroll column must use .page-column.');
    assert.equal(state.plainColumns,true,'Breadcrumb columns must use the shared plain list layout.');
    assert.ok(state.columns.every(column=>Math.abs(column.width-state.nav.width)<=1),'Navigation columns must share a width.');
    assert.ok(state.declared.column>0&&Math.abs(state.nav.width-state.declared.column)<=1,'Navigation width must match --navigation-column-inline.');
    assert.deepEqual(state.nestedHorizontalScrollers,[],'Columns must not create a nested horizontal scroller.');
    assert.equal(state.unifiedCanvas,true,'Every scroll column must belong to the same canvas grid.');
    assert.ok(state.declared.gap>0&&state.gaps.every(gap=>Math.abs(gap-state.declared.gap)<=.1),'Root, path and main columns must share --page-shell-gap-inline.');
    assert.ok(state.columnLinks.every(count=>count>0),'Each breadcrumb column must have links.');
    assert.ok([state.nav,...state.columns].every(column=>Math.abs(column.y-state.main.y)<=1),'Columns must begin at the same vertical position.');
    assert.equal(state.x,0,'Direct visits must preserve the canvas origin.');
    if(state.collection) {
      assert.ok(state.list&&state.declared.list>0&&Math.abs(state.list.width-state.declared.list)<=1,'Collection list width must match its determined field width.');
      assert.ok(Math.abs(state.main.width-state.list.width-state.list.margins-state.mainInlineSpace)<=1,'Collection main width must fit its list and inline spacing.');
      assert.ok(Math.abs(state.readingWidth-state.main.width-state.readingInlineSpace)<=1,'Collection reading column must fit its main width, scrollbar and inline spacing.');
    } else {
      assert.ok(state.main.width<=state.viewport+1,'Reading and settings columns must fit the viewport.');
      const minimumMain=Math.min(state.declared.main,state.readingClientWidth);
      assert.ok(state.declared.main>0&&state.main.width+1>=minimumMain,'Main must not shrink below --main-column-inline within its reading column.');
    }
    if(state.main.right>state.viewport)assert.ok(state.scrollWidth>state.clientWidth,'Canvas overflow must reach the document scroller.');
    if(width<=430)assert.ok(state.scrollWidth>state.viewport&&state.nav.x>=0&&state.nav.right<=state.viewport,'Narrow pages must pan while keeping root navigation visible.');
    if(state.prose)assert.ok(state.prose.width<=(state.collection?state.main.width:state.viewport)&&state.proseOverflow<=1,'Prose must fit without horizontal overflow.');
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
