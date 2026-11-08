import assert from 'node:assert/strict';
import {openPage,selectColumn,columnsSelector} from '../_shared/page.mjs';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';

async function readHeader(header) {
  return header.evaluate(node=>{
    const list=node.closest('.item-list'),sort=node.querySelector('[data-collection-sort-toggle]');
    const arrow=sort?.querySelector('[data-sort-indicator]');
    if(!sort||!arrow)return null;
    const bounds=node.getBoundingClientRect(),sortBox=sort.getBoundingClientRect(),arrowBox=arrow.getBoundingClientRect();
    return {width:node.clientWidth,contentWidth:node.scrollWidth,left:bounds.left,right:bounds.right,height:bounds.height,
      label:list.getAttribute('aria-label'),role:list.getAttribute('role'),
      repeatedName:!!node.querySelector('.path-column-label,.path-column-separator'),
      rowHeight:list.querySelector('[data-list-entry]')?.getBoundingClientRect().height,
      border:parseFloat(getComputedStyle(node).borderBottomWidth),
      sortField:sort.querySelector('.path-sort-label')?.textContent.trim(),action:sort.getAttribute('aria-label'),sortTitle:sort.title,
      sortInset:sortBox.left-bounds.left,sortLeft:sortBox.left,sortRight:sortBox.right,sortWidth:sortBox.width,arrowLeft:arrowBox.left,arrowRight:arrowBox.right,arrowWidth:arrowBox.width,
      indicator:arrow.textContent.trim(),visible:getComputedStyle(sort).visibility==='visible'&&getComputedStyle(sort).display!=='none'};
  });
}

function checkHeader(state) {
  assert.ok(state,'Column must have a sort control and direction indicator.');
  assert.ok(state.label&&state.role==='group','Column must retain its accessible name.');
  assert.ok(!state.repeatedName,'Column header must show only sorting.');
  assert.ok(state.sortField&&state.action?.includes(state.sortField)&&state.sortTitle===state.action,'Sort control must name its field and retain its accessible action.');
  assert.ok(state.width>0&&state.sortWidth>0&&state.arrowWidth>0&&state.visible,'Sort control must be visible.');
  assert.ok(state.contentWidth<=state.width+1&&state.sortLeft>=state.left-.1&&state.sortRight<=state.right+.1&&state.arrowLeft>=state.left-.1&&state.arrowRight<=state.right+.1,
    'Column must not clip the sort control or direction indicator.');
  if(state.rowHeight)assert.ok(Math.abs(state.height-state.border-state.rowHeight)<=1,'Header must retain the ordinary row height.');
}

export async function check({page,baseUrl,options}) {
  const cases=[];
  for(const width of options.widths.split(',').map(Number)) {
    await page.setViewportSize({width,height:900});await openPage(page,baseUrl+options.page);
    const column=await selectColumn(page,options.column),header=page.locator(columnsSelector+'[data-breadcrumb-collection-href='+JSON.stringify(column.href)+'] .list-header--path');
    const initial=await readHeader(header);checkHeader(initial);
    const toggle=header.locator('[data-collection-sort-toggle]');await toggle.click();
    await page.waitForFunction(({selector,previous})=>document.querySelector(selector)?.textContent.trim()!==previous,
      {selector:columnsSelector+'[data-breadcrumb-collection-href='+JSON.stringify(column.href)+'] [data-sort-indicator]',previous:initial.indicator});
    await waitForBrowse(page);await afterPaint(page);
    const sorted=await readHeader(header);checkHeader(sorted);
    assert.notEqual(sorted.indicator,initial.indicator,'Sorting must change its direction indicator.');
    assert.notEqual(sorted.action,initial.action,'Sorting must update its accessible action.');
    assert.equal(sorted.label,initial.label,'Sorting must retain the accessible column name.');
    for(const key of ['height','sortInset','sortWidth'])assert.ok(Math.abs(sorted[key]-initial[key])<=.1,'Sorting must retain header spacing.');
    cases.push({width,column:column.href,initial,sorted});
  }
  return {page:options.page,cases};
}
