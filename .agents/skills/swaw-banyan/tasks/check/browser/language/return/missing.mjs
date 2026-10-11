import assert from 'node:assert/strict';

export async function checkMissingNotice(page,label) {
  const notice=page.locator('[data-language-return-notice]');
  assert.equal(await notice.count(),1,'A missing translation must show exactly one return notice.');
  assert.equal(await notice.getAttribute('role'),'status','Missing translation notices must be accessible status messages.');
  assert.equal(await notice.isVisible(),true,'A missing translation notice must be visible.');
  const text=(await notice.textContent()).trim();
  assert.ok(text.includes(label),'A missing translation notice must identify the selected language by its visible name.');
  return {text,label};
}
