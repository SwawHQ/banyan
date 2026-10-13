import assert from 'node:assert/strict';

export async function checkPrefetchSlots(page) {
  const state=await page.locator('[data-slot=breadcrumb]').evaluate(node=>{
    const entries=[...node.querySelectorAll('[data-list-entry][href]')],anchors=[...node.querySelectorAll('a[href]')];
    const describe=link=>({href:link.getAttribute('href'),slot:link.dataset.prefetchSlot||''});
    return {entries:entries.length,anchors:anchors.length,
      invalid:anchors.filter(link=>link.dataset.prefetchSlot!=='crumb').map(describe)};
  });
  assert.ok(state.entries>0,'Breadcrumb prefetch checks need rendered collection entries.');
  assert.deepEqual(state.invalid,[],'Runtime breadcrumb anchors must keep data-prefetch-slot="crumb".');
  return state;
}
