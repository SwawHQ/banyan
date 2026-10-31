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
  const source = await page.evaluate(()=>({logicalPath:document.body.dataset.collectionPath}));
  assert.ok(source?.logicalPath,'Collection source metadata is required.');
  const readRows = () => grid.evaluate(node=>{
    const fields=[...node.querySelector(':scope > [data-list-header]').children].map(cell=>cell.dataset.itemField);
    const rows = [...node.querySelectorAll(':scope > [data-list-item]')].map(row=>{
      const cells=[...row.children],entry=row.querySelector(':scope > [data-list-entry]');
      if(!entry||cells.length!==fields.length||cells.some((cell,index)=>cell.dataset.itemField!==fields[index]))throw new Error('Collection has incomplete rows.');
      return {key:new URL(entry.href).pathname,name:row.dataset.sortName,date:row.dataset.sortDate||'',group:row.dataset.sortGroup||'0',cells:cells.map(cell=>cell.textContent.trim())};
    });
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
  const valueCell = grid.locator('[data-list-item] > [data-item-field]:not([data-item-field="name"])').first();
  if (await valueCell.count()) assert.ok(await valueCell.evaluate(cell=>{
    const box=cell.getBoundingClientRect();
    return cell.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));
  }),'Value cells must remain pointer targets for selection and native tooltips.');
  if(await valueCell.count()) {
    const position=await valueCell.evaluate(cell=>{
      const texts=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT),box=cell.getBoundingClientRect();let text;
      while((text=texts.nextNode()))if(text.textContent.trim()) {
        const range=document.createRange();range.selectNodeContents(text);const rect=range.getBoundingClientRect();
        const left=Math.max(rect.left,box.left),right=Math.min(rect.right,box.right);
        const top=Math.max(rect.top,box.top),bottom=Math.min(rect.bottom,box.bottom);
        if(right>left&&bottom>top)return {x:(left+right)/2-box.left,y:(top+bottom)/2-box.top};
      }
    });
    assert.ok(position,'Value selection checks need visible text.');
    await valueCell.dblclick({position});
    assert.ok(await valueCell.evaluate(cell=>{
      const selection=getSelection();
      return selection.toString().trim()&&cell.contains(selection.anchorNode)&&cell.contains(selection.focusNode);
    }),'Value text must remain selectable with the mouse.');
    await page.evaluate(()=>getSelection().removeAllRanges());
  }
  await grid.evaluate(node=>{
    window.__swbanSortGrid=node;
    window.__swbanSortNodes=[...node.querySelectorAll('*')].map(node=>({node,parent:node.parentElement}));
    window.__swbanSortMarker=crypto.randomUUID();
    for (const element of [node,...node.querySelectorAll('[class]')]) element.removeAttribute('class');
  });
  const marker = await page.evaluate(()=>window.__swbanSortMarker);
  const target = new URL(await control.getAttribute('href'),page.url());
  await control.focus();await page.keyboard.press('Enter');await page.waitForURL(target.href);
  assert.equal(await page.evaluate(()=>window.__swbanSortMarker),marker,'Sorting must keep the current document.');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('banyan:canvas-navigation')),null,'In-place sorting must not create a pending canvas navigation.');
  assert.ok(await grid.evaluate(node=>window.__swbanSortGrid===node&&window.__swbanSortNodes.length===node.querySelectorAll('*').length
    &&window.__swbanSortNodes.every(record=>record.node.parentElement===record.parent&&node.contains(record.node))),'Sorting must reuse its grid, headers, complete rows and cells.');
  assert.ok(await control.evaluate(node=>document.activeElement===node),'Keyboard sorting must retain control focus.');
  const after = await readRows();
  assert.ok(after.descending,'Names must be descending within each group.');
  assert.deepEqual(after.rows.map(row=>row.key),[...before].reverse().map(row=>row.key),'Name sorting must reverse the complete group/name/href tuple.');
  assert.deepEqual([...after.rows].sort((a,b)=>a.key.localeCompare(b.key)),[...before].sort((a,b)=>a.key.localeCompare(b.key)),
    'Sorting must keep every row and all of its cell values.');
  assert.notDeepEqual(after.rows.map(row=>row.key),before.map(row=>row.key),'Distinct names must change order.');

  const sourcePath = source.logicalPath.replace(/^\/+|\/+$/g,'');
  const entries = await grid.locator('[data-list-entry]').evaluateAll(nodes=>nodes.map(node=>node.href));
  const entryHref = entries.find(href=>[...new URLSearchParams(new URL(href).hash.slice(1)).values()].some(value=>value.replace(/^\/+|\/+$/g,'')===sourcePath));
  assert.ok(entryHref,'The collection must contain an article link with its declared source.');
  assert.ok([...new URLSearchParams(new URL(entryHref).hash.slice(1)).values()].some(value=>value==='name-desc'||value.split(',').includes('name-desc')),
    'Article links must carry the active descending sort.');
  const descendingUrl=page.url(),ascendingUrl=new URL(await control.getAttribute('href'),page.url()),requests=[];
  const record=request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())requests.push(request.url());};
  page.on('request',record);
  try {
    await page.evaluate(hash=>{location.hash=hash;},ascendingUrl.hash);
    await page.waitForFunction(()=>document.querySelector('[data-sort-field="name"] [data-sort-indicator]')?.textContent==='↑');
    assert.deepEqual((await readRows()).rows.map(row=>row.key),before.map(row=>row.key),'A fragment change must apply the requested main sort.');
    await page.goBack();await page.waitForURL(descendingUrl);
    await page.waitForFunction(()=>document.querySelector('[data-sort-field="name"] [data-sort-indicator]')?.textContent==='↓');
    assert.deepEqual((await readRows()).rows.map(row=>row.key),after.rows.map(row=>row.key),'Back must restore the previous main sort.');
    assert.equal(await page.evaluate(()=>window.__swbanSortMarker),marker,'Fragment sort history must retain the document.');
    assert.deepEqual(requests,[],'Fragment sorting must not request another document.');
  } finally {page.off('request',record);}
  const entry = grid.locator(`[data-list-entry][href=${JSON.stringify(new URL(entryHref).pathname+new URL(entryHref).search+new URL(entryHref).hash)}]`);
  await entry.click(); await page.waitForURL(entryHref);
  await page.locator(`[data-root-navigation] [data-root-href=${JSON.stringify(rootHref)}].is-current`).waitFor({state:'visible'});
  return {page:options.page,rows:before.length,source:sourcePath,root:rootHref,target:new URL(entryHref).pathname,dates};
}
