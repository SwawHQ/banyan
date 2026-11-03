import assert from 'node:assert/strict';

export async function contentIndicator(page,state,published) {
  const status=page.locator('[data-site-content-status]');
  await page.waitForFunction(state=>document.querySelector('[data-site-content-status]')?.dataset.siteContentState===state,state);
  assert.ok(await status.isVisible(),'The page-version comparison must be visible.');
  assert.equal(await status.getAttribute('role'),'status');
  assert.equal(await status.getAttribute('aria-live'),'polite');
  const copy=await status.evaluate(node=>JSON.parse(node.dataset.siteContentCopy));
  const refresh=page.locator('[data-site-content-action="check"]');
  assert.equal(await refresh.isVisible(),true,'The version refresh button stays in its row.');
  assert.equal(await refresh.isDisabled(),['checking','unavailable'].includes(state));
  assert.equal(await refresh.getAttribute('aria-label'),copy.content_refresh);
  assert.equal(await refresh.textContent(),copy.refresh_icon);
  assert.equal(await status.locator('code').count(),0,'Server version has no inline-code formatting.');
  if(['current','changed'].includes(state)) {
    const link=status.locator('a');
    assert.equal(await link.count(),1);
    assert.equal(await link.getAttribute('href'),await status.getAttribute('data-site-version-url'));
    assert.equal(await link.locator('bdi').textContent(),published);
    const icon=status.locator('[role="img"]');
    assert.equal(await icon.count(),state==='current'?1:0);
    if(state==='current') {
      assert.equal(await icon.textContent(),copy.content_current_icon);
      assert.equal(await icon.getAttribute('aria-label'),copy.content_current);
    }
  } else {
    assert.equal(await status.textContent(),copy[state==='unavailable'?'cache_disabled':'content_'+state]);
    assert.equal(await status.locator('a').count(),0);
  }
}
