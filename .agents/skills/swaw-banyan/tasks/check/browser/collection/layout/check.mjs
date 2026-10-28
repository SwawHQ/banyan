import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';

async function visit(page,url) {
  await page.goto('about:blank');
  const response=await page.goto(url,{waitUntil:'load'});
  assert.ok(response?.ok(),'Page must return a successful response.');await waitForBrowse(page);await afterPaint(page);
}

async function readList(list) {
  assert.equal(await list.count(),1,'Page must contain the requested collection list.');
  return list.evaluate(node=>{
    const heading=node.querySelector(':scope > [data-list-header]');
    const header=heading?.querySelector('[data-item-field="name"]'),label=header?.querySelector('a');
    const items=[...node.querySelectorAll(':scope > [data-list-item]')];
    const rows=items.map(item=>item.querySelector(':scope > [data-list-entry]'));
    const link=rows[0],icon=link?.querySelector('.item-icon'),title=link?.querySelector('.item-title');
    if(!header||!label||!link||!icon||!title)return null;
    const texts=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);let text;
    while((text=texts.nextNode()))if(text.textContent.trim())break;
    if(!text)return null;
    const range=document.createRange();range.selectNodeContents(text);
    const box=node.getBoundingClientRect(),row=link.getBoundingClientRect(),mark=icon.getBoundingClientRect();
    const separator=getComputedStyle(heading);
    const probe=document.createElement('span');probe.style.cssText='position:absolute;visibility:hidden;inline-size:var(--navigation-column-inline)';
    node.append(probe);const declaredWidth=probe.getBoundingClientRect().width;probe.remove();
    const root=document.querySelector('[data-root-navigation] .item-control').getBoundingClientRect();
    const children=[...node.children],fields=[...heading.children].map(cell=>cell.dataset.itemField);
    const readFields=row=>({display:getComputedStyle(row).display,columns:getComputedStyle(row).gridTemplateColumns,
      template:getComputedStyle(row).getPropertyValue('--list-field-tracks'),
      fields:[...row.children].map(cell=>({field:cell.dataset.itemField,x:cell.getBoundingClientRect().left-box.left,width:cell.getBoundingClientRect().width,contentWidth:cell.scrollWidth}))});
    return {top:box.top,nameWidth:header.getBoundingClientRect().width,headerX:header.getBoundingClientRect().left-box.left,declaredWidth,
      fields,heading:readFields(heading),items:items.map(readFields),headerTrack:heading.getBoundingClientRect().height,
      headerY:range.getBoundingClientRect().top-box.top,rowY:row.top-box.top,rowHeight:row.height,rowWidth:row.width,
      iconX:separator.direction==='rtl'?row.right-mark.right:mark.left-row.left,
      titleGap:separator.direction==='rtl'?mark.left-title.getBoundingClientRect().right:title.getBoundingClientRect().left-mark.right,
      separatorY:heading.getBoundingClientRect().bottom-box.top,separatorWidth:Number.parseFloat(separator.borderBottomWidth),
      paddingStart:Number.parseFloat(getComputedStyle(link).paddingInlineStart),
      rows:rows.map(row=>({x:row.getBoundingClientRect().left-box.left,width:row.getBoundingClientRect().width,height:row.getBoundingClientRect().height})),
      rootWidth:root.width,rootHeight:root.height,
      completeRows:children.length===items.length+1&&children.every(child=>child===heading||child.hasAttribute('data-list-item')),
      pathGrid:node.matches('.item-list.item-list--path-column'),
      nameOnly:fields.length===1&&fields[0]==='name'&&items.every(item=>item.children.length===1&&item.firstElementChild.dataset.itemField==='name'),
      documentWidth:document.scrollingElement.clientWidth,documentScrollWidth:document.scrollingElement.scrollWidth};
  });
}

function checkList(state) {
  assert.ok(state,'Choose a nonempty collection with a name header, row icons and titles.');
  assert.ok(state.completeRows&&state.items.length>0&&state.fields[0]==='name'&&state.fields.every(Boolean),
    'Collection headers and complete rows must be direct list children.');
  assert.ok(state.declaredWidth>0&&Math.abs(state.nameWidth-state.declaredWidth)<=1,'Name column must match --navigation-column-inline.');
  for(const row of [state.heading,...state.items]) {
    assert.ok(row.display==='grid'&&!row.columns.includes('subgrid'),'Each collection row must use an independent Grid.');
    assert.ok(row.template.trim()&&!/max-content|min-content|subgrid|\bauto\b|[\d.]fr\b/.test(row.template),'Collection field tracks must have determined widths.');
    assert.deepEqual(row.fields.map(cell=>cell.field),state.fields,'Each row must contain every declared field in order.');
    assert.ok(row.fields.every((cell,index)=>cell.width>0&&Math.abs(cell.x-state.heading.fields[index].x)<=.1&&Math.abs(cell.width-state.heading.fields[index].width)<=.1),
      'Every row field must match its header width and column start.');
  }
  assert.ok(state.heading.fields.every(cell=>cell.field==='name'||cell.contentWidth<=cell.width+1),
    'Metadata headers and sort indicators must fit their fixed field width: '+JSON.stringify(state.heading.fields));
  assert.ok(Math.abs(state.rootWidth-state.nameWidth)<=1&&Math.abs(state.rootHeight-state.rowHeight)<=.1,'Collection rows must share root navigation dimensions.');
  assert.ok(state.rows.every(row=>Math.abs(row.width-state.nameWidth)<=1&&Math.abs(row.height-state.rowHeight)<=.1&&Math.abs(row.x-state.headerX)<=.1),
    'Name rows must share width, height and column start.');
  assert.ok(state.separatorWidth>0&&state.rowY>=state.separatorY-.1,'Rows must start below the header separator.');
  assert.ok(state.paddingStart<=.1&&Math.abs(state.iconX)<=.1&&state.titleGap>0,'Row icons must begin at the name-column edge with a visible title gap.');
}

export async function check({page,baseUrl,options}) {
  const cases=[];
  for(const width of options.widths.split(',').map(Number)) {
    await page.setViewportSize({width,height:900});await visit(page,baseUrl+options.page);
    const main=await readList(page.locator('.slot-main .item-list'));checkList(main);
    let path;
    if(options.article) {
      await visit(page,baseUrl+options.article);
      const href=new URL(options.page,baseUrl).pathname;
      path=await readList(page.locator('[data-slot=breadcrumb] [data-breadcrumb-collection-href='+JSON.stringify(href)+'] > .item-list'));checkList(path);
      assert.ok(path.pathGrid&&path.nameOnly,'Path collections must contain name fields only.');
      for(const metric of ['top','headerTrack','headerY','rowY','rowHeight','iconX','titleGap','separatorY']) {
        assert.ok(Math.abs(main[metric]-path[metric])<=.1,'Main and path lists must align: '+metric+'.');
      }
    }
    cases.push({width,main,...(path?{path}:{})});
  }
  return {page:options.page,article:options.article,cases};
}
