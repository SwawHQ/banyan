import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';
import {readColumns,openPage,columnSort} from '../_shared/page.mjs';
import {toggleColumn} from '../sort/check.mjs';

const readMain=page=>page.evaluate(()=>{
  const grid=document.querySelector('.slot-main [data-sortable]');if(!grid)return null;
  const control=grid.querySelector('[data-sort-active="true"]');
  return {source:JSON.parse(document.body.dataset.pageCollectionSource||'null'),
    field:control?.dataset.sortField,indicator:control?.querySelector('[data-sort-indicator]')?.textContent.trim(),
    rows:[...grid.querySelectorAll('[data-list-entry]')].map(link=>({key:new URL(link.href).pathname,href:link.href,text:link.textContent.trim()}))};
});
const order=column=>({href:column.href,field:column.field,indicator:column.indicator,rows:column.rows.map(({key,text})=>({key,text}))});

function checkQueryPreservation(before,after) {
  const previous=new URL(before),next=new URL(after);
  assert.equal(next.pathname,previous.pathname,'Sorting must keep the page pathname.');
  if(new URLSearchParams(previous.hash.slice(1)).has('from'))assert.equal(new URLSearchParams(next.hash.slice(1)).get('from'),new URLSearchParams(previous.hash.slice(1)).get('from'),'Sorting must preserve the full source lineage.');
  for(const url of [previous,next]) {
    const fields=new URLSearchParams(url.hash.slice(1));
    for(const key of ['from','sorts'])fields.delete(key);
    fields.sort();url.hash=fields.toString();
  }
  previous.searchParams.sort();next.searchParams.sort();
  assert.equal(next.href,previous.href,'Path sorting must preserve main sort, unrelated query fields and fragment.');
}

function checkMainLinks(main,columns) {
  if(!main)return;
  assert.ok(main.source?.logicalPath,'Main collection must declare its source.');
  const defaults=main.source.defaultSort,depth=main.source.logicalPath.split('/').filter(Boolean).length;
  const active=main.field+'-'+(main.indicator==='↑'?'asc':'desc');
  const links=main.rows.filter(row=>new URLSearchParams(new URL(row.href).hash.slice(1)).has('from'));
  assert.ok(links.length>0,'Main collection must contain an article with source context.');
  for(const row of links) {
    const url=new URL(row.href),slots=(new URLSearchParams(url.hash.slice(1)).get('sorts')||'').split(',');
    const effective=[...Array(Math.max(0,depth-slots.length)).fill('_'),...slots];
    const tokenAt=(index,fallback)=>effective[index]&&effective[index]!=='_'?effective[index]:fallback;
    assert.equal(tokenAt(depth-1,defaults),active,'Main article links must retain the active collection sort.');
    assert.equal(new URLSearchParams(url.hash.slice(1)).get('sort')||defaults,active,'Main article links must retain their own sort token.');
    for(const column of columns.filter(column=>column.toggle)) {
      const columnDepth=column.source.logicalPath.split('/').filter(Boolean).length;
      if(columnDepth>=depth)continue;
      const requested=(new URLSearchParams(url.hash.slice(1)).get('sorts')||'').split(',');
      assert.ok(requested.length<=depth,'Main article links must not append an extra sort slot.');
      assert.equal(tokenAt(columnDepth-1,column.source.defaultSort),columnSort(column),
        'Main article links must reflect each ancestor sort.');
    }
  }
}

export async function check({page,baseUrl,options}) {
  await page.setViewportSize({width:1440,height:960});
  const url=baseUrl+options.page;await openPage(page,url);
  const initial=await readColumns(page),main=await readMain(page),initialUrl=page.url(),targets=initial.filter(column=>column.toggle);
  assert.ok(targets.length>=2||(targets.length>=1&&main),'Choose two sortable path columns, or a path column and main collection.');
  const cases=[];
  for(const target of targets) {
    await openPage(page,url);
    const before=await readColumns(page),mainBefore=await readMain(page),previous=page.url();
    const result=await toggleColumn(page,target.href),after=await readColumns(page),mainAfter=await readMain(page);
    checkQueryPreservation(previous,page.url());
    assert.deepEqual(after.filter(column=>column.href!==target.href).map(order),before.filter(column=>column.href!==target.href).map(order),
      'Sorting one path column must not change another column order or indicator.');
    if(mainBefore) {
      assert.deepEqual(order(mainAfter),order(mainBefore),'Path sorting must not change main collection order or indicator.');
      checkMainLinks(mainBefore,before);checkMainLinks(mainAfter,after);
    }
    cases.push({column:target.href,url:page.url(),...result});
  }
  let mainSort;
  if(main) {
    await openPage(page,url);const before=await readColumns(page),mainBefore=await readMain(page);
    const control=page.locator('.slot-main [data-sort-active="true"]');
    assert.equal(await control.count(),1,'Main collection must expose one active sort control.');
    const marker=await page.evaluate(()=>window.__swbanMainSort=crypto.randomUUID()),target=await control.evaluate(node=>node.href);
    await control.click();await page.waitForURL(target);await waitForBrowse(page);await afterPaint(page);
    assert.equal(await page.evaluate(()=>window.__swbanMainSort),marker,'Main sorting must retain the document.');
    const after=await readColumns(page),mainAfter=await readMain(page);
    assert.deepEqual(after.map(order),before.map(order),'Main sorting must not change breadcrumb order or indicators.');
    assert.notDeepEqual(mainAfter.rows.map(row=>row.key),mainBefore.rows.map(row=>row.key),'Main collection needs distinct sort values.');
    checkMainLinks(mainAfter,after);mainSort={before:mainBefore,after:mainAfter};
  }
  return {page:options.page,initial:{url:initialUrl,columns:initial,main},cases,mainSort};
}
