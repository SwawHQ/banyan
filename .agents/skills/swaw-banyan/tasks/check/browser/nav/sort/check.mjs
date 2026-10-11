import assert from 'node:assert/strict';
import {checkDates} from './dates.mjs';

export async function check({page,baseUrl,options}) {
  const response = await page.goto(baseUrl+options.page,{waitUntil:'load'});
  assert.ok(response?.ok(),'Collection must return a successful response.');
  const grid = page.locator('.slot-main [data-sortable]');
  assert.equal(await grid.count(),1,'The page must have one sortable collection.');
  const control = grid.locator('[data-sort-field="name"]');
  assert.equal(await control.count(),1,'The collection must expose a name sort control.');
  const currentRoot = page.locator('[data-root-navigation] [data-root-href].is-current');
  assert.equal(await currentRoot.count(),1,'Collection must have one active root entry.');
  const rootHref = await currentRoot.getAttribute('data-root-href');
  const source = await page.evaluate(()=>JSON.parse(document.body.dataset.pageCollectionSource||'null'));
  assert.ok(source?.logical_path,'Collection source metadata is required.');
  const readRows = () => grid.evaluate(node=>{
    const count = Number(node.dataset.sortColumns);
    if (!Number.isInteger(count)||count<1) throw new Error('Invalid declared column count.');
    const cells = [...node.children].filter(cell=>cell.hasAttribute('data-collection-cell')&&!cell.hasAttribute('data-collection-header'));
    if (cells.length%count) throw new Error('Collection has incomplete rows.');
    const rows = [];
    for (let i=0;i<cells.length;i+=count) {
      const row = cells.slice(i,i+count),head=row[0],entry=head.querySelector('[data-collection-entry]');
      rows.push({key:new URL(entry.href).pathname,name:head.dataset.sortName,date:head.dataset.sortDate||'',group:head.dataset.sortGroup||'0',cells:row.map(cell=>cell.textContent.trim())});
    }
    return {rows,descending:rows.every((row,i)=>!i||rows[i-1].group!==row.group||rows[i-1].name.localeCompare(row.name,undefined,{numeric:true,sensitivity:'base'})>=0)};
  });
  const dates=await checkDates(page,grid,readRows);
  const ascending = () => control.evaluate(node=>node.dataset.sortActive==='true' && node.querySelector('[data-sort-indicator]')?.textContent==='↑');
  if (!(await ascending())) {
    const target = new URL(await control.getAttribute('href'),page.url());
    await control.click(); await page.waitForURL(target.href);
  }
  assert.ok(await ascending(),'The first name sort must select ascending order.');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('banyan:canvas-navigation')),null,'In-place sorting must not create a pending canvas navigation.');
  const before = (await readRows()).rows;
  assert.ok(before.some((row,i)=>before.some((other,j)=>i!==j&&row.group===other.group&&row.name!==other.name)),
    'Sorting needs at least two distinct names in the same group.');
  const valueCell = grid.locator('[data-collection-cell]:not([data-collection-header]):not([data-collection-cell="name"])').first();
  if (await valueCell.count()) assert.ok(await valueCell.evaluate(cell=>{
    const box=cell.getBoundingClientRect();
    return cell.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));
  }),'Value cells must remain pointer targets for selection and native tooltips.');
  await grid.evaluate(node=>{
    window.__swbanSortGrid=node;
    window.__swbanSortNodes=[...node.children];
    window.__swbanSortMarker=crypto.randomUUID();
    for (const element of [node,...node.querySelectorAll('[class]')]) element.removeAttribute('class');
  });
  const marker = await page.evaluate(()=>window.__swbanSortMarker);
  const target = new URL(await control.getAttribute('href'),page.url());
  await control.click(); await page.waitForURL(target.href);
  assert.equal(await page.evaluate(()=>window.__swbanSortMarker),marker,'Sorting must keep the current document.');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('banyan:canvas-navigation')),null,'In-place sorting must not create a pending canvas navigation.');
  assert.ok(await grid.evaluate(node=>window.__swbanSortGrid===node&&window.__swbanSortNodes.length===node.children.length
    &&window.__swbanSortNodes.every(child=>child.parentElement===node)),'Sorting must reuse its grid, headers and cells.');
  const after = await readRows();
  assert.ok(after.descending,'Names must be descending within each group.');
  assert.deepEqual(after.rows.map(row=>row.key),[...before].reverse().map(row=>row.key),'Name sorting must reverse the complete group/name/href tuple.');
  assert.deepEqual([...after.rows].sort((a,b)=>a.key.localeCompare(b.key)),[...before].sort((a,b)=>a.key.localeCompare(b.key)),
    'Sorting must keep every row and all of its cell values.');
  assert.notDeepEqual(after.rows.map(row=>row.key),before.map(row=>row.key),'Distinct names must change order.');

  const sourcePath = source.logical_path.replace(/^\/+|\/+$/g,'');
  const entries = await grid.locator('[data-collection-entry]').evaluateAll(nodes=>nodes.map(node=>node.href));
  const entryHref = entries.find(href=>[...new URL(href).searchParams.values()].some(value=>value.replace(/^\/+|\/+$/g,'')===sourcePath));
  assert.ok(entryHref,'The collection must contain an article link with its declared source.');
  assert.ok([...new URL(entryHref).searchParams.values()].some(value=>value==='name-desc'||value.split(',').includes('name-desc')),
    'Article links must carry the active descending sort.');
  const entry = grid.locator(`[data-collection-entry][href=${JSON.stringify(new URL(entryHref).pathname+new URL(entryHref).search)}]`);
  await entry.click(); await page.waitForURL(entryHref);
  await page.locator(`[data-root-navigation] [data-root-href=${JSON.stringify(rootHref)}].is-current`).waitFor({state:'visible'});
  return {page:options.page,rows:before.length,source:sourcePath,root:rootHref,target:new URL(entryHref).pathname,dates};
}
