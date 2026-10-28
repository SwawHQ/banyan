import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';
import {assertCanvasEnd} from '../_shared/state.mjs';
import {touchDrag} from '../_shared/touch.mjs';

const staticState=page=>page.evaluate(()=>{
  const view=window.visualViewport,offset=view?.offsetLeft??0,viewport=view?.width??innerWidth;
  const rect=node=>{const box=node.getBoundingClientRect();return {left:box.left-offset,right:box.right-offset,width:box.width};};
  const columns=[...document.querySelectorAll('.page-column')].filter(node=>node.getClientRects().length);
  const first=document.querySelector('[data-root-navigation]')??document.querySelector('#main');
  let scroller=first.parentElement;
  while(scroller&&scroller!==document.scrollingElement
    &&!(/auto|scroll/.test(getComputedStyle(scroller).overflowX)&&scroller.scrollWidth>scroller.clientWidth+1))scroller=scroller.parentElement;
  scroller??=document.scrollingElement;
  return {direction:document.documentElement.dir,flow:getComputedStyle(document.querySelector('.page-shell')).direction,
    first:rect(first),last:rect(columns.at(-1)),viewport,scroller:scroller.tagName,
    x:scroller===document.scrollingElement?(view?.pageLeft??scrollX):scroller.scrollLeft,
    edge:parseFloat(getComputedStyle(document.body).paddingInlineStart),
    scrollWidth:scroller.scrollWidth};
});

function assertStaticStart(state) {
  assert.ok(state.first.left>=-1&&state.first.right<=state.viewport+1,
    'Static first content column must be visible on arrival: '+JSON.stringify(state));
  const start=state.flow==='rtl'?state.viewport-state.first.right:state.first.left;
  assert.ok(Math.abs(start-state.edge)<=1,'Static first column must start at the reading edge: '+JSON.stringify(state));
}

export async function checkStaticLayout({browser,baseUrl,options}) {
  const noScript=[];
  for(const mobile of [false,true]) {
    const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block',
      ...(mobile?{hasTouch:true,isMobile:true}:{})});
    context.setDefaultTimeout(options.timeout??15000);context.setDefaultNavigationTimeout(options.timeout??15000);
    let cdp;
    try {
      const page=await context.newPage();
      if(mobile&&browser.browserType().name()==='chromium')cdp=await context.newCDPSession(page);
      for(const width of mobile?[390]:options.widths.split(',').map(Number)) {
        await page.setViewportSize({width,height:options.height??900});
        await page.goto('about:blank');
        const response=await page.goto(baseUrl+options.page,{waitUntil:'load'});
        assert.ok(response?.ok(),'Static pages must return a successful response.');
        const initial=await staticState(page);assertStaticStart(initial);
        const aside=page.locator('.document-aside');
        if(await aside.count())assert.equal(await aside.isVisible(),true,'Static articles must retain their document information.');
        const url=page.url(),endVisible=state=>state.flow==='rtl'?state.last.left>=state.edge-1:state.last.right<=state.viewport-state.edge+1;
        let current=initial,gestures=0;
        const input=cdp?'touch':mobile?null:'wheel';
        const limit=Math.ceil(initial.scrollWidth/(initial.viewport-80))+4;
        while(input&&!endVisible(current)&&gestures<limit) {
          const direction=current.flow==='rtl'?-1:1;
          const before=current.x;
          const point=await page.evaluate(({width,direction})=>{
            const view=window.visualViewport,x=direction===1?width-2:2;
            const padding=parseFloat(getComputedStyle(document.body).paddingBlockStart);
            for(const y of [Math.max(.5,padding/2),1,(view?.height??innerHeight)-1]) {
              let node=document.elementFromPoint(x+(view?.offsetLeft??0),y+(view?.offsetTop??0)),nested=false;
              for(;node&&node!==document.body&&node!==document.documentElement;node=node.parentElement)
                if(!node.matches('.page,.page-shell,.reading-group')&&/auto|scroll/.test(getComputedStyle(node).overflowX)
                  &&node.scrollWidth>node.clientWidth+1){nested=true;break;}
              if(!nested)return {x,y};
            }
            return null;
          },{width,direction});
          assert.ok(point,'Static input needs a canvas edge outside nested horizontal scrollers.');
          if(cdp)await touchDrag(page,cdp,{...point,dx:-direction*(width-80)});
          else {
            await page.mouse.move(point.x,point.y);
            await page.mouse.wheel(direction*initial.scrollWidth,0);
            await page.waitForTimeout(80);
          }
          current=await staticState(page);gestures++;
          assert.ok(Math.abs(current.x-before)>1,'Native horizontal input must move the static canvas: '+JSON.stringify(current));
        }
        if(input)assert.ok(endVisible(current),'Native horizontal input must reveal the static final column: '+JSON.stringify(current));
        assert.equal(page.url(),url,'Static horizontal input must not activate a link.');
        noScript.push({width,mobile,initial,native:{input,gestures,state:current,
          ...(input?{}:{skipReason:'Native mobile gestures are unavailable in Playwright WebKit.'})},...await assertCanvasEnd(page)});
      }
    } finally {try{await cdp?.detach();}finally{await context.close();}}
  }
  return {noScript:noScript.filter(state=>!state.mobile),noScriptMobile:noScript.find(state=>state.mobile)};
}

export async function check({page,baseUrl,options}) {
  const results=[];
  for(const width of options.widths.split(',').map(Number)) {
    await page.setViewportSize({width,height:options.height??900});
    await page.goto('about:blank');
    const response=await page.goto(baseUrl+options.page,{waitUntil:'load'});
    assert.ok(response?.ok(),'Page must return a successful response.');await waitForBrowse(page);await afterPaint(page);
    const state=await page.evaluate(()=>{
      const view=window.visualViewport,rtl=getComputedStyle(document.documentElement).direction==='rtl',viewport=view?.width||innerWidth,rect=node=>{
        const box=node.getBoundingClientRect(),x=box.x-(view?.offsetLeft||0),right=box.right-(view?.offsetLeft||0);
        return {x:rtl?viewport-right:x,y:box.y-(view?.offsetTop||0),width:box.width,right:rtl?viewport-x:right,height:box.height};
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
      const tracks=[nav,...columns,main].filter(Boolean).map(rect),canvas=document.querySelector('.page-shell'),group=canvas.querySelector(':scope > .reading-group');
      const tailColumns=[...canvas.querySelectorAll('.page-content,.document-aside')].filter(node=>node.getClientRects().length);
      const tailColumnsWidth=rect(tailColumns.at(-1)).right-rect(tailColumns[0]).x;
      const tail=rect(group).right-rect(tailColumns.at(-1)).right;
      const scrollColumns=[...document.querySelectorAll('.page-column,.page-rail,.path-column,.page-content,.document-aside')];
      const unifiedCanvas=document.querySelectorAll('.page-shell').length===1&&canvas.querySelectorAll('.reading-group').length===1
        &&getComputedStyle(group).overflowX==='visible'&&getComputedStyle(group).overflowY==='visible'&&scrollColumns.every(column=>{
        let parent=column.parentElement;
        while(parent&&parent!==canvas&&getComputedStyle(parent).display==='contents')parent=parent.parentElement;
        return parent===canvas||parent===group;
      });
      const ancestors=new Set();
      for(const column of scrollColumns) {
        for(let node=column;node&&node!==document.scrollingElement;node=node.parentElement)ancestors.add(node);
      }
      const nestedHorizontalScrollers=[...ancestors].filter(node=>['auto','scroll','hidden'].includes(getComputedStyle(node).overflowX)
        &&node.scrollWidth>node.clientWidth+1).map(node=>node.className);
      return {main:rect(main),nav:nav?rect(nav):null,navigationEnabled:document.body.dataset.homeNavigation!=='false',railCount:document.querySelectorAll('.page-rail').length,columns:columns.map(rect),columnLinks:columns.map(node=>node.querySelectorAll('[data-list-entry][href]').length),
        declared,gaps:tracks.slice(1).map((track,index)=>track.x-tracks[index].right),
        unifiedCanvas,nestedHorizontalScrollers,clientWidth:document.scrollingElement.clientWidth,
        readingClientWidth:content.clientWidth,readingWidth:rect(content).width,
        readingInlineSpace:content.offsetWidth-content.clientWidth+inlineSpace(content,['paddingLeft','paddingRight'])+inlineSpace(main,['marginLeft','marginRight']),
        mainInlineSpace:inlineSpace(main,['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth']),
        list:list?{...rect(list),margins:inlineSpace(list,['marginLeft','marginRight'])}:null,
        plainColumns:columns.every(node=>node.querySelector(':scope > .item-list.item-list--path-column')&&!node.querySelector('[aria-expanded],[role="menu"],[hidden]')),
        sharedColumns:scrollColumns.every(node=>node.classList.contains('page-column')),
        rootNavigationCount:document.querySelectorAll('[data-root-navigation]').length,
        rootCount:nav?.querySelectorAll('[data-root-href]').length??0,
        rootEntriesVisible:[...nav?.querySelectorAll('[data-root-href]')??[]].every(link=>link.getClientRects().length>0&&getComputedStyle(link).visibility==='visible'),
        prose:prose?rect(prose):null,proseOverflow:prose?prose.scrollWidth-prose.clientWidth:0,
        collection,footer:footer?rect(footer):null,footerInRail:!footer||!!footer.closest('.page-rail'),
        tail,tailColumnsWidth,canvasWidth:document.querySelector('.page').getBoundingClientRect().width,
        viewport:view?.width||innerWidth,scrollWidth:document.scrollingElement.scrollWidth,x:view?.pageLeft??scrollX};
    });
    if(state.navigationEnabled)assert.ok(state.rootCount>0,'The page must have root navigation entries.');
    else assert.equal(state.railCount,0,'Disabled root navigation must not reserve a rail.');
    assert.equal(state.rootNavigationCount,state.navigationEnabled?1:0,'Root navigation must match the declared visibility.');
    assert.equal(state.rootEntriesVisible,true,'Every root entry must remain visible.');
    assert.equal(state.sharedColumns,true,'Every scroll column must use .page-column.');
    assert.equal(state.plainColumns,true,'Breadcrumb columns must use the shared plain list layout.');
    assert.ok(state.columns.every(column=>Math.abs(column.width-state.declared.column)<=1),'Navigation columns must share a width.');
    if(state.nav)assert.ok(state.declared.column>0&&Math.abs(state.nav.width-state.declared.column)<=1,'Navigation width must match --navigation-column-inline.');
    assert.deepEqual(state.nestedHorizontalScrollers,[],'Columns must not create a nested horizontal scroller.');
    assert.equal(state.unifiedCanvas,true,'Every scroll column must belong to the canvas or its non-scrolling reading group.');
    assert.ok(Math.abs(state.tail-Math.max(0,state.canvasWidth-state.tailColumnsWidth))<=1,'Tail space must subtract the final reading columns and their gap, and must not be negative.');
    assert.ok(state.declared.gap>0&&state.gaps.every(gap=>Math.abs(gap-state.declared.gap)<=.1),'Root, path and main columns must share --page-shell-gap-inline.');
    assert.ok(state.columnLinks.every(count=>count>0),'Each breadcrumb column must have links.');
    assert.ok([state.nav,...state.columns].filter(Boolean).every(column=>Math.abs(column.y-state.main.y)<=1),'Columns must begin at the same vertical position.');
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
    if(width<=430&&state.nav)assert.ok(state.scrollWidth>state.viewport&&state.nav.x>=0&&state.nav.right<=state.viewport,'Narrow pages must pan while keeping root navigation visible.');
    if(state.prose)assert.ok(state.prose.width<=(state.collection?state.main.width:state.viewport)&&state.proseOverflow<=1,'Prose must fit without horizontal overflow.');
    assert.ok(state.footerInRail,'The footer must remain in the root navigation rail.');
    if(state.footer)assert.ok(Math.abs(state.footer.x-state.nav.x)<=1&&state.footer.y>=state.nav.y+state.nav.height,'The footer must align below root navigation.');
    const end=await assertCanvasEnd(page);
    await page.evaluate(()=>scrollTo({left:0,top:0,behavior:'instant'}));await afterPaint(page);
    const bounds=await page.locator(state.navigationEnabled?'[data-root-navigation]':'#main').boundingBox();
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width,'The canvas origin must reveal the first content column.');
    results.push({width,height:options.height??900,...state,end});
  }
  assert.ok(results.every(state=>state.columns.length===results[0].columns.length&&state.rootCount===results[0].rootCount),
    'The same page must expose the same navigation at every width.');
  return {page:options.page,cases:results,...await checkStaticLayout({browser:page.context().browser(),baseUrl,options})};
}
