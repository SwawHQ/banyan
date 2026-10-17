import assert from 'node:assert/strict';
import {waitForBrowse} from '../_shared/viewport.mjs';

export async function check({page,baseUrl,options={page:'/'}}) {
  const consoleMessages = [],preloadMessages=[];
  const record=message => {
    if (/content.security.policy|\bcsp\b/i.test(message.text())) consoleMessages.push(message.text());
    if (/preload/i.test(message.text())&&/request credentials mode does not match/i.test(message.text())) preloadMessages.push(message.text());
  };
  page.on('console',record);
  try {
    await page.addInitScript(() => {
      window.__swbanCspViolations = [];
      document.addEventListener('securitypolicyviolation',event => window.__swbanCspViolations.push({
        directive:event.effectiveDirective,blockedURI:event.blockedURI,disposition:event.disposition
      }));
    });
    const response = await page.goto(baseUrl+options.page,{waitUntil:'load'});
    assert.ok(response?.ok(),'Selected page must return a successful response.');
    const headers=response.headers(),csp=headers['content-security-policy'] ?? '';
    assert.ok(csp,'Response is missing enforced Content-Security-Policy.');
    const script = csp.split(';').map(value=>value.trim()).find(value=>value.startsWith('script-src '));
    assert.ok(script?.split(/\s+/).includes("'self'"),'CSP must declare script-src with self.');
    assert.ok(!script.split(/\s+/).some(token => ["'unsafe-inline'","'unsafe-eval'"].includes(token)),
      'script-src must not allow unsafe-inline or unsafe-eval.');
    await page.locator('.slot-main').waitFor({state:'visible'});
    await waitForBrowse(page);
    // CSP events and console reports can be queued after the load event.
    await page.waitForTimeout(250);
    const violations = await page.evaluate(() => window.__swbanCspViolations);
    assert.deepEqual(violations,[],'Browser reported CSP violations.');
    assert.deepEqual(consoleMessages,[],'Browser emitted CSP console messages.');
    assert.deepEqual(preloadMessages,[],'Browser emitted preload credential mismatch messages.');
    return {page:options.page,headers,csp,violations,preloadMessages};
  } finally {page.off('console',record);}
}
