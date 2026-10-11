import assert from 'node:assert/strict';

export const readRootState=page=>page.evaluate(()=>{
  const navigation=document.querySelector('[data-root-navigation]');
  const links=[...navigation?.querySelectorAll('[data-root-href]')??[]];
  return {count:document.querySelectorAll('[data-root-navigation]').length,
    roots:links.map(link=>link.dataset.rootHref),
    selected:links.filter(link=>link.classList.contains('is-current')).map(link=>link.dataset.rootHref),
    current:links.filter(link=>link.getAttribute('aria-current')==='page').map(link=>link.dataset.rootHref)};
});

export function assertRootSelection(state,expected=false) {
  assert.equal(state.count,1,'The page must have one root navigation.');
  assert.ok(state.roots.length>0,'Root navigation must contain links.');
  assert.equal(new Set(state.roots).size,state.roots.length,'Root entries must be unique.');
  assert.ok(state.selected.length<=1,'Root navigation must select at most one entry.');
  assert.deepEqual(state.current,state.selected,'Root selection and aria-current must agree.');
  if(expected!==false)assert.deepEqual(state.selected,expected?[expected]:[],'Root selection must match the expected entry.');
}

export async function checkRootSelection(page,expected,roots) {
  const state=await readRootState(page);assertRootSelection(state,expected);
  assert.deepEqual(state.roots,roots,'Root selection must retain the complete root list.');
  return state;
}
