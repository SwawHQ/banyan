import assert from 'node:assert/strict';
import {readColumns,columnSort} from '../../breadcrumb/_shared/page.mjs';
import {assertRootSelection,checkRootSelection} from '../../nav/_shared/root.mjs';

export async function readOpeningSource(page,canvas) {
  const state=await page.evaluate(()=>({
    source:JSON.parse(document.body.dataset.entryBreadcrumbSources||'[]')
      .find(source=>source.current_collection_source?.href===location.pathname),
    rows:[...document.querySelectorAll('main [data-collection-entry][href]')]
      .map(link=>({path:new URL(link.href).pathname,text:link.textContent.trim()}))
  }));
  const source=state.source;
  assert.ok(source?.logical_path&&source.root_item?.href,'The collection must declare its source and root.');
  const root=canvas.root.roots.includes(source.root_item.href)?source.root_item.href:'';
  assertRootSelection(canvas.root,root);
  return {logicalPath:source.logical_path,rootHref:source.root_item.href,root,roots:canvas.root.roots,
    sort:new URL(page.url()).searchParams.get('sort')||source.current_collection_source.default_sort,
    columns:[...canvas.pathContent.map(({href,rows})=>({href,rows})),
      {href:source.current_collection_source.href,rows:state.rows}]};
}

export async function checkOpeningSource(page,source) {
  const url=new URL(page.url()),from=source.logicalPath.replace(/^\/+|\/+$/g,'');
  assert.equal(url.searchParams.get('from'),from,'The article must retain its declared collection source.');
  const state=await page.evaluate(logicalPath=>({
    source:JSON.parse(document.body.dataset.entryBreadcrumbSources||'[]').find(source=>source.logical_path===logicalPath),
    selections:[...document.querySelectorAll('.slot-breadcrumb [data-collection-column]')].map(column=>({
      selected:[...column.querySelectorAll('[data-collection-entry].is-current')].map(link=>new URL(link.href).pathname),
      current:[...column.querySelectorAll('[data-collection-entry][aria-current="page"]')].map(link=>new URL(link.href).pathname)
    }))
  }),source.logicalPath);
  assert.equal(state.source?.root_item?.href,source.rootHref,'The article must retain its declared source root.');
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
