import assert from 'node:assert/strict';
import {afterPaint} from '../../../../_shared/browser/viewport.mjs';

const compareNames=(left,right)=>left.localeCompare(right,undefined,{numeric:true,sensitivity:'base'});
const dateOrder=rows=>[...rows].sort((left,right)=>Number(left.group)-Number(right.group)
  ||Number(left.date)-Number(right.date)||compareNames(left.name,right.name)
  ||left.key.localeCompare(right.key,undefined,{numeric:true,sensitivity:'variant'}));

export async function checkDates(page,grid,readRows) {
  const control=grid.locator('[data-sort-field="date"]');
  if(!await control.count())return null;
  assert.equal(await control.count(),1,'The collection must have one date sort control.');
  const descending=()=>control.evaluate(node=>node.dataset.sortActive==='true'&&node.querySelector('[data-sort-indicator]')?.textContent==='↓');
  const activate=async()=>{
    const target=new URL(await control.getAttribute('href'),page.url());
    await control.click();await page.waitForURL(target.href);await afterPaint(page);
  };
  if(!await descending())await activate();
  assert.ok(await descending(),'Date checks must start with descending order.');
  const before=(await readRows()).rows,url=page.url();
  assert.ok(before.every(row=>!row.date||/^\d{14}$/.test(row.date)),'Machine date keys must preserve second-level precision.');
  const ascending=dateOrder(before).map(row=>row.key),expectedDescending=[...ascending].reverse();
  assert.deepEqual(before.map(row=>row.key),expectedDescending,'Initial date order must follow the complete group/date/name/href tuple.');
  const marker=await grid.evaluate(node=>{
    window.__swbanDateSort={node,cells:[...node.children],marker:crypto.randomUUID()};
    return window.__swbanDateSort.marker;
  });
  let requests=0;
  const record=request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())requests++;};
  page.on('request',record);
  const cases=[];
  try {
    for(const [direction,expected] of [['asc',ascending],['desc',expectedDescending]]) {
      await activate();
      const rows=(await readRows()).rows;
      assert.deepEqual(rows.map(row=>row.key),expected,'Date sorting must follow the complete group/date/name/href tuple: '+direction);
      assert.equal(await control.evaluate(node=>node.querySelector('[data-sort-indicator]').textContent),direction==='asc'?'↑':'↓');
      assert.deepEqual([...rows].sort((a,b)=>a.key.localeCompare(b.key)),[...before].sort((a,b)=>a.key.localeCompare(b.key)),
        'Date sorting must keep every row, key and cell value.');
      assert.equal(await page.evaluate(()=>sessionStorage.getItem('banyan:canvas-navigation')),null,
        'In-place sorting must not create a pending canvas navigation.');
      assert.ok(await grid.evaluate((node,wanted)=>{
        const probe=window.__swbanDateSort;
        return probe?.marker===wanted&&probe.node===node&&probe.cells.length===node.children.length&&probe.cells.every(cell=>cell.parentElement===node);
      },marker),'Date sorting must reuse its document, grid, headers and cells.');
      cases.push({direction,keys:rows.map(row=>row.key)});
    }
  } finally {page.off('request',record);}
  assert.equal(requests,0,'Date sorting must not request another document.');
  assert.equal(page.url(),url,'Two date toggles must restore the original URL.');
  return {datedRows:before.filter(row=>row.date).length,requests,cases};
}
