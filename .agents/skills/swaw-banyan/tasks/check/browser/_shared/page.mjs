export async function gotoAndWait(page, url) {
  const response = await page.goto(url, {waitUntil:'load'});
  await page.waitForLoadState('networkidle').catch(() => {});
  return response;
}
