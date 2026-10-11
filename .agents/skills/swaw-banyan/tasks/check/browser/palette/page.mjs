import assert from 'node:assert/strict';

export async function openProse(page,baseUrl,route) {
  await page.emulateMedia({reducedMotion:'reduce'});
  const response = await page.goto(baseUrl+route,{waitUntil:'load'});
  assert.ok(response?.ok(),'Prose page must return a successful response: '+route);
  assert.equal(await page.locator('.prose').count(),1,'The selected page must have one prose container.');
  await page.locator('.prose').waitFor({state:'visible'});
}
