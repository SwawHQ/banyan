import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';
import {readColumns,selectColumn,columnLocator,observeColumns,columnSort} from '../_shared/page.mjs';
import {checkPrefetchSelectors} from './prefetch.mjs';

function normalizedSortURL(value,defaultSort) {
  const url=new URL(value),fields=new URLSearchParams(url.hash.slice(1)),raw=fields.get('sorts');
  if(raw) {
    const tokens=raw.split(',').map(token=>token===defaultSort?'_':token);
    if(tokens.every(token=>token==='_'))fields.delete('sorts');
    else fields.set('sorts',tokens.join(','));
  }
  fields.sort();url.hash=fields.toString();url.searchParams.sort();return url.href;
}

// Isolation checks reuse the in-place sort contract, not the CLI or page setup.
export async function toggleColumn(page,href) {
  const column=columnLocator(page,href),before=(await readColumns(page)).find(column=>column.href===href);
  assert.ok(before?.toggle,'Column must have a sort toggle.');
  assert.ok(before.rows.length>=2,'Choose a column with at least two sortable rows.');
  assert.ok(['↑','↓'].includes(before.indicator),'Column must expose its current sort direction.');
  const marker=await column.evaluate(node=>{
    const toggle=node.querySelector('[data-collection-sort-toggle]');toggle.focus({preventScroll:true});
    const probe=window.__swbanColumnSort={node,nodes:[...node.querySelectorAll('[data-list-header],[data-list-item],[data-item-field],.item-icon')],
      marker:crypto.randomUUID(),running:true,minimumVisibleRows:Infinity,blankObserved:false};
    const sample=()=>{
      if(!probe.running)return;
      const rail=node.closest('[data-slot=breadcrumb]'),railStyle=getComputedStyle(rail),style=getComputedStyle(node);
      const count=[...node.querySelectorAll('[data-list-entry]')].filter(link=>{
        const box=link.getBoundingClientRect(),style=getComputedStyle(link);
        return box.width>0&&box.height>0&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0;
      }).length;
      probe.minimumVisibleRows=Math.min(probe.minimumVisibleRows,count);
      if(!node.isConnected||!count||[style,railStyle].some(style=>style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0))probe.blankObserved=true;
      requestAnimationFrame(sample);
    };
    sample();return probe.marker;
  });
  const position=await page.evaluate(()=>({x:scrollX,y:scrollY,reading:document.querySelector('.page-content').scrollTop}));
  let requests=0;
  const record=request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())requests++;};
  page.on('request',record);
  let continuity;
  try {
    // Activate without Playwright scrolling the header back into view.
    await column.locator('[data-collection-sort-toggle]').evaluate(node=>node.click());
    await waitForBrowse(page);await afterPaint(page);
    assert.equal(normalizedSortURL(page.url(),before.source.defaultSort),normalizedSortURL(before.toggle,before.source.defaultSort),
      'Sorting must follow the declared toggle URL, treating default sort slots and placeholders equally.');
  } finally {
    page.off('request',record);
    continuity=await page.evaluate(()=>{
      const probe=window.__swbanColumnSort;if(!probe)return null;probe.running=false;
      return {marker:probe.marker,minimumVisibleRows:probe.minimumVisibleRows,blankObserved:probe.blankObserved,
        retained:probe.node.isConnected&&probe.nodes.every(node=>node.isConnected&&probe.node.contains(node)),
        focused:document.activeElement===probe.node.querySelector('[data-collection-sort-toggle]')};
    });
  }
  assert.equal(requests,0,'Breadcrumb sorting must not request another document.');
  assert.equal(continuity?.marker,marker,'Breadcrumb sorting must retain the document.');
  assert.equal(continuity.retained,true,'Breadcrumb sorting must reuse rows, icons and headers.');
  assert.equal(continuity.blankObserved,false,'Breadcrumb sorting must not show a blank frame.');
  assert.ok(continuity.minimumVisibleRows>0,'Breadcrumb rows must remain visible while sorting.');
  assert.equal(continuity.focused,true,'Breadcrumb sorting must retain toggle focus.');
  const after=(await readColumns(page)).find(column=>column.href===href);
  assert.equal(after.y,before.y,'Breadcrumb sorting must preserve column scroll position.');
  assert.deepEqual(await page.evaluate(()=>({x:scrollX,y:scrollY,reading:document.querySelector('.page-content').scrollTop})),position,
    'Breadcrumb sorting must preserve canvas and reading positions.');
  assert.equal(after.field,before.field,'Direction toggling must retain the sort field.');
  assert.equal(after.indicator,before.indicator==='↑'?'↓':'↑','Sort indicator must reverse direction.');
  const content=rows=>rows.map(({key,text})=>({key,text})).sort((a,b)=>a.key.localeCompare(b.key));
  assert.deepEqual(content(after.rows),content(before.rows),'Sorting must retain every row and its text.');
  assert.notDeepEqual(after.rows.map(row=>row.key),before.rows.map(row=>row.key),'Choose distinct sort values; toggling must change row order.');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('banyan:canvas-navigation')),null,'In-place sorting must not create a navigation record.');
  return {before,after,continuity,requests,url:page.url(),prefetch:await checkPrefetchSelectors(page)};
}

export async function check({page,baseUrl,options}) {
  await page.setViewportSize({width:1440,height:130});
  const initial=await observeColumns(page,baseUrl+options.page),selected=await selectColumn(page,options.column);
  const prefetch=await checkPrefetchSelectors(page);
  const slots=(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('sorts')||'').split(',');
  const depth=selected.source.logicalPath.split('/').filter(Boolean).length;
  const requested=slots[Math.min(depth,slots.length)-1];
  assert.equal(columnSort(selected),requested&&requested!=='_'?requested:selected.source.defaultSort,
    'Initial breadcrumb sort must reflect the requested slot or declared default.');
  assert.ok(initial.sourcePending,'Path columns must wait for their JSON data.');
  assert.ok(initial.columns.length>0&&initial.columns.every(column=>column.rows.length===0),
    'Reserved path columns must not inline list rows.');
  assert.ok(await page.evaluate(()=>{
    const columns=[...document.querySelectorAll('[data-slot=breadcrumb] [data-collection-column]')];
    return window.__swbanParsedColumns.length===columns.length
      &&window.__swbanParsedColumns.every((record,index)=>record.column===columns[index]&&record.column.isConnected);
  }),'Initial loading must retain reserved column nodes.');
  const column=columnLocator(page,selected.href);
  const probe=await column.evaluate(node=>{
    const links=[...node.querySelectorAll('[data-list-entry]')].map(link=>{
      const url=new URL(link.href);url.searchParams.set('swban-probe','keep');const fields=new URLSearchParams(url.hash.slice(1));fields.set('anchor','swban-reading');url.hash=fields.toString();link.href=url.href;
      return {key:url.pathname,from:new URLSearchParams(url.hash.slice(1)).get('from')};
    });
    node.scrollTop=Math.min(35,node.scrollHeight-node.clientHeight);
    return {links,y:node.scrollTop};
  });
  assert.ok(probe.y>0,'Choose a breadcrumb column that overflows at 130 pixels high.');
  const cases=[];
  for(let i=0;i<2;i++) {
    const result=await toggleColumn(page,selected.href);cases.push(result);
    for(const original of probe.links) {
      const link=new URL(result.after.rows.find(row=>row.key===original.key).href);
      assert.equal(link.searchParams.get('swban-probe'),'keep','Sorting must preserve unrelated link query parameters.');
      assert.equal(new URLSearchParams(link.hash.slice(1)).get('anchor')||decodeURIComponent(link.hash.slice(1)),'swban-reading','Sorting must preserve link fragments.');
      assert.equal(new URLSearchParams(link.hash.slice(1)).get('from'),original.from,'Sorting must preserve each row source.');
    }
  }
  assert.deepEqual(cases[1].after.rows.map(row=>row.key),cases[0].before.rows.map(row=>row.key),'Two toggles must restore the original row order.');
  const originalUrl=page.url(),original=await selectColumn(page,selected.href);
  const chapters=page.locator('.document-toc a[data-chapter-anchor]');
  const anchor=await chapters.count()?chapters.last():page.locator('a[data-chapter-anchor="main"]').first();
  // Native anchor navigation creates an entry that sorting then replaces.
  await anchor.evaluate(link=>link.click());await afterPaint(page);
  await column.locator('[data-collection-sort-toggle]').evaluate(link=>link.click());await afterPaint(page);
  const sortedUrl=page.url(),sorted=await selectColumn(page,selected.href);
  const state=column=>({field:column.field,indicator:column.indicator,rows:column.rows});
  for(const [navigation,url,expected] of [['goBack',originalUrl,original],['goForward',sortedUrl,sorted]]) {
    await page[navigation]();await page.waitForURL(url);await waitForBrowse(page);await afterPaint(page);
    assert.deepEqual(state(await selectColumn(page,selected.href)),state(expected),
      navigation+' must restore breadcrumb row order, indicators and link sort fields.');
    assert.equal(await page.evaluate(()=>window.__swbanColumnSort?.marker),cases[1].continuity.marker,
      'Fragment history must retain the document.');
  }
  return {page:options.page,column:selected.href,sourceRebuilt:initial.sourcePending,
    reservedColumns:initial.columns.length,initialRows:initial.columns.reduce((total,column)=>total+column.rows.length,0),prefetch,cases};
}
