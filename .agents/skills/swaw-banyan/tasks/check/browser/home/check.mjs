import assert from 'node:assert/strict';

export async function check({page,baseUrl}) {
  const errors = [], failedAssets = [];
  page.on('pageerror',error => errors.push(error.message));
  page.on('requestfailed',request => {
    if (new URL(request.url()).origin === baseUrl && ['script','stylesheet'].includes(request.resourceType())) {
      failedAssets.push(request.failure()?.errorText+' '+request.url());
    }
  });
  page.on('response',response => {
    if (new URL(response.url()).origin === baseUrl && ['script','stylesheet'].includes(response.request().resourceType()) && response.status() >= 400) {
      failedAssets.push(response.status()+' '+response.url());
    }
  });
  const response = await page.goto(baseUrl+'/',{waitUntil:'load'});
  assert.ok(response?.ok(),'Home page must return a successful response.');
  await page.locator('.slot-main').waitFor({state:'visible'});
  const title = (await page.title()).trim();
  assert.ok(title,'Home page title is empty.');
  assert.deepEqual(failedAssets,[],'Home page has failed script or stylesheet responses.');
  assert.deepEqual(errors,[],'Home page has uncaught JavaScript errors.');
  return {title};
}
