import assert from 'node:assert/strict';
import {openPage,selectColumn,columnsSelector} from '../_shared/page.mjs';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';

async function readHeader(header) {
  return header.evaluate(node=>{
    const label=node.querySelector('.path-column-label'),separator=node.querySelector('.path-column-separator');
    const sort=node.querySelector('[data-collection-sort-toggle]'),arrow=sort?.querySelector('[data-sort-indicator]');
    if(!label||!separator||!sort||!arrow)return null;
    const bounds=node.getBoundingClientRect(),labelBox=label.getBoundingClientRect(),sepBox=separator.getBoundingClientRect();
    const sortBox=sort.getBoundingClientRect(),arrowBox=arrow.getBoundingClientRect();
    const rtl=getComputedStyle(node).direction==='rtl';
    return {width:node.clientWidth,contentWidth:node.scrollWidth,left:bounds.left,right:bounds.right,
      label:label.textContent.trim(),title:label.title,labelWidth:labelBox.width,labelContentWidth:label.scrollWidth,
      sortLeft:sortBox.left,sortRight:sortBox.right,sortWidth:sortBox.width,arrowLeft:arrowBox.left,arrowRight:arrowBox.right,arrowWidth:arrowBox.width,
      labelToSeparator:rtl?labelBox.left-sepBox.right:sepBox.left-labelBox.right,
      separatorToSort:rtl?sepBox.left-sortBox.right:sortBox.left-sepBox.right,
      indicator:arrow.textContent.trim(),visible:getComputedStyle(sort).visibility==='visible'&&getComputedStyle(sort).display!=='none'};
  });
}

function checkHeader(state) {
  assert.ok(state,'Column must have a label, separator and sort control.');
  assert.ok(state.label&&state.title===state.label,'Column label must retain its full title.');
  assert.ok(state.width>0&&state.labelWidth>0&&state.sortWidth>0&&state.arrowWidth>0&&state.visible,'Column label and sort control must be visible.');
  assert.ok(state.contentWidth<=state.width+1&&state.sortLeft>=state.left-.1&&state.sortRight<=state.right+.1&&state.arrowLeft>=state.left-.1&&state.arrowRight<=state.right+.1,
    'Column label must not clip the sort control or direction indicator.');
  assert.ok(state.labelToSeparator>0&&state.separatorToSort>0,'Label, separator and sort control must have visible spacing.');
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
    assert.equal(sorted.label,initial.label,'Sorting must retain the column label.');
    for(const gap of ['labelToSeparator','separatorToSort'])assert.ok(Math.abs(sorted[gap]-initial[gap])<=.1,'Sorting must retain header spacing.');
    cases.push({width,column:column.href,initial,sorted});
  }
  return {page:options.page,cases};
}
