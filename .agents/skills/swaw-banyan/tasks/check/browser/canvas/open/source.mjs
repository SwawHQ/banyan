import assert from 'node:assert/strict';
import {readColumns,columnSort} from '../../breadcrumb/_shared/page.mjs';
import {assertRootSelection,checkRootSelection} from '../../nav/_shared/root.mjs';

export async function readOpeningSource(page,canvas) {
  const state=await page.evaluate(()=>{
    const navigation=JSON.parse(document.body.dataset.navigation),logicalPath=document.body.dataset.collectionPath;
    const root=logicalPath?navigation.home+logicalPath.replace(/^\/+/, '').split('/')[0]+'/':'',active=document.querySelector('main [data-sort-control][data-sort-active="true"]');
    const indicator=active?.querySelector('[data-sort-indicator]')?.textContent.trim();
    return {source:root?{logicalPath,rootItem:{href:root}}:null,
      sort:active?active.dataset.sortField+'-'+(indicator==='↑'?'asc':'desc'):'',
      rows:[...document.querySelectorAll('main [data-list-entry][href]')].map(link=>({path:new URL(link.href).pathname,text:link.textContent.trim()}))};
  });
  const source=state.source;
  assert.ok(source?.logicalPath&&source.rootItem?.href,'The collection must declare its source and root.');
  const root=canvas.root.roots.includes(source.rootItem.href)?source.rootItem.href:'';
  assertRootSelection(canvas.root,root);
  return {logicalPath:source.logicalPath,rootHref:source.rootItem.href,root,roots:canvas.root.roots,
    sort:state.sort,
    columns:[...canvas.pathContent.map(({href,rows})=>({href,rows})),
      {href:new URL(page.url()).pathname,rows:state.rows}]};
}

export async function checkOpeningSource(page,source) {
  const url=new URL(page.url()),from=source.logicalPath.replace(/^\/+|\/+$/g,'');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('from'),from,'The article must retain its declared collection source.');
  const state=await page.evaluate(logicalPath=>({
    source:(()=>{const navigation=JSON.parse(document.body.dataset.navigation);return Object.hasOwn(navigation.columns,logicalPath)
      ?{root:navigation.home+logicalPath.replace(/^\/+/, '').split('/')[0]+'/'}:null;})(),
    selections:[...document.querySelectorAll('[data-slot=breadcrumb] [data-collection-column]')].map(column=>({
      selected:[...column.querySelectorAll('[data-list-entry].is-current')].map(link=>new URL(link.href).pathname),
      current:[...column.querySelectorAll('[data-list-entry][aria-current="page"]')].map(link=>new URL(link.href).pathname)
    }))
  }),source.logicalPath);
  assert.equal(state.source?.root,source.rootHref,'The article must retain its declared source root.');
  await checkRootSelection(page,source.root,source.roots);
  const columns=await readColumns(page);
  assert.deepEqual(columns.map(column=>({href:column.href,rows:column.rows.map(({key,text})=>({path:key,text}))})),source.columns,
    'Opening and history must retain every source column, sibling and row order.');
  for(const [index,selection] of state.selections.entries()) {
    const expected=[columns[index+1]?.href||url.pathname];
    assert.deepEqual(selection.selected,expected,'Each source column must select its next collection or article.');
    assert.deepEqual(selection.current,expected,'Source selection and aria-current must identify the same row.');
  }
  assert.equal(columnSort(columns.at(-1)),source.sort,'The article source column must retain the collection sort.');
  return {from,root:source.root,columns:columns.map(column=>column.href),sort:source.sort};
}
