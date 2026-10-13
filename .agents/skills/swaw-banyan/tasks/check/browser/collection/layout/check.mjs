import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';

async function visit(page,url) {
  await page.goto('about:blank');
  const response=await page.goto(url,{waitUntil:'load'});
  assert.ok(response?.ok(),'Page must return a successful response.');await waitForBrowse(page);await afterPaint(page);
}

async function readList(list) {
  assert.equal(await list.count(),1,'Page must contain the requested collection list.');
  return list.evaluate(node=>{
    const header=node.querySelector('.collection-cell--name.collection-header'),label=header?.querySelector('a');
    const rows=[...node.querySelectorAll(':scope > .collection-cell--name:not(.collection-cell--header) .collection-item-link')];
    const link=rows[0],icon=link?.querySelector('.collection-item-icon'),title=link?.querySelector('.collection-item-title');
    if(!header||!label||!link||!icon||!title)return null;
    const texts=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);let text;
    while((text=texts.nextNode()))if(text.textContent.trim())break;
    if(!text)return null;
    const range=document.createRange();range.selectNodeContents(text);
    const box=node.getBoundingClientRect(),row=link.getBoundingClientRect(),mark=icon.getBoundingClientRect();
    const style=getComputedStyle(node),separator=getComputedStyle(node,'::after');
    const probe=document.createElement('span');probe.style.cssText='position:absolute;visibility:hidden;inline-size:var(--navigation-column-inline)';
    node.append(probe);const declaredWidth=probe.getBoundingClientRect().width;probe.remove();
    const root=document.querySelector('[data-root-navigation] .collection-item-link').getBoundingClientRect();
    const cells=[...node.children],headers=cells.filter(cell=>cell.hasAttribute('data-collection-header'));
    return {top:box.top,nameWidth:header.getBoundingClientRect().width,headerX:header.getBoundingClientRect().left-box.left,declaredWidth,
      columns:style.gridTemplateColumns.split(' ').map(Number.parseFloat),headerTrack:Number.parseFloat(style.gridTemplateRows),
      headerY:range.getBoundingClientRect().top-box.top,rowY:row.top-box.top,rowHeight:row.height,rowWidth:row.width,
      iconX:mark.left-row.left,titleGap:title.getBoundingClientRect().left-mark.right,
      separatorY:Number.parseFloat(separator.top),separatorWidth:Number.parseFloat(separator.borderBottomWidth),separatorContent:separator.content,
      paddingStart:Number.parseFloat(getComputedStyle(link).paddingInlineStart),
      rows:rows.map(row=>({x:row.getBoundingClientRect().left-box.left,width:row.getBoundingClientRect().width,height:row.getBoundingClientRect().height})),
      rootWidth:root.width,rootHeight:root.height,headerCount:headers.length,cellCount:cells.length,
      directCells:cells.every(cell=>cell.hasAttribute('data-collection-cell')),
      pathGrid:node.matches('.collection-list.collection-list--headed.collection-list--path-column'),
      nameOnly:cells.every(cell=>cell.classList.contains('collection-cell--name')),
      documentWidth:document.scrollingElement.clientWidth,documentScrollWidth:document.scrollingElement.scrollWidth};
  });
}

function checkList(state) {
  assert.ok(state,'Choose a nonempty collection with a name header, row icons and titles.');
  assert.ok(state.directCells&&state.headerCount>0&&state.cellCount>state.headerCount&&state.cellCount%state.headerCount===0,
    'Collection headers and rows must be direct cells in one complete grid.');
  assert.ok(state.declaredWidth>0&&Math.abs(state.nameWidth-state.declaredWidth)<=1,'Name column must match --navigation-column-inline.');
  assert.ok(state.columns.length===state.headerCount&&Math.abs(state.columns[0]-state.declaredWidth)<=1,'Grid tracks must match the declared header columns.');
  assert.ok(Math.abs(state.rootWidth-state.nameWidth)<=1&&Math.abs(state.rootHeight-state.rowHeight)<=.1,'Collection rows must share root navigation dimensions.');
  assert.ok(state.rows.every(row=>Math.abs(row.width-state.nameWidth)<=1&&Math.abs(row.height-state.rowHeight)<=.1&&Math.abs(row.x-state.headerX)<=.1),
    'Name rows must share width, height and column start.');
  assert.ok(state.separatorContent!=='none'&&state.separatorWidth>0&&state.rowY>state.separatorY+1,'Rows must start below the header separator.');
  assert.ok(state.paddingStart<=.1&&Math.abs(state.iconX)<=.1&&state.titleGap>0,'Row icons must begin at the name-column edge with a visible title gap.');
}

export async function check({page,baseUrl,options}) {
  const cases=[];
  for(const width of options.widths.split(',').map(Number)) {
    await page.setViewportSize({width,height:900});await visit(page,baseUrl+options.page);
    const main=await readList(page.locator('.slot-main .collection-list'));checkList(main);
    let path;
    if(options.article) {
      await visit(page,baseUrl+options.article);
      const href=new URL(options.page,baseUrl).pathname;
      path=await readList(page.locator('.slot-breadcrumb [data-breadcrumb-collection-href='+JSON.stringify(href)+'] > .collection-list'));checkList(path);
      assert.ok(path.pathGrid&&path.nameOnly,'Path collections must keep a single grid of name cells.');
      for(const metric of ['top','headerTrack','headerY','rowY','rowHeight','iconX','titleGap','separatorY']) {
        assert.ok(Math.abs(main[metric]-path[metric])<=.1,'Main and path lists must align: '+metric+'.');
      }
    }
    cases.push({width,main,...(path?{path}:{})});
  }
  return {page:options.page,article:options.article,cases};
}
