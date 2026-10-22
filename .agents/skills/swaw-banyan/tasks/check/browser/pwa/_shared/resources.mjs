import assert from 'node:assert/strict';
import {parseSwPolicy} from '../../../delivery/sw/policy.mjs';
import {compilePath} from '../../../delivery/_shared/path.mjs';

export async function pageResources(page,baseUrl,version) {
  const response=await page.context().request.get(new URL('/sw-policy.json',baseUrl).href);
  assert.ok(response.ok(),'Resource checks need the published sw-policy.json.');
  const routes=parseSwPolicy(await response.text()).map(route=>({...route,pattern:compilePath(route.path)}));
  const urls=await page.locator('link[rel="stylesheet"][href],script[src]').evaluateAll(nodes=>nodes.map(node=>node.href||node.src));
  return [...new Set(urls)].filter(url=>new URL(url).origin===new URL(baseUrl).origin).map(url=>{
    const bucket=routes.find(route=>route.pattern.test(new URL(url).pathname))?.bucket??'off';
    return {url,bucket,cache:bucket==='fingerprinted'?'asset-fingerprint':bucket==='versioned'?'asset-versioned-'+version:null};
  });
}

export async function missingResources(page,resources) {
  return page.evaluate(async resources=>{
    const keys=await caches.keys(),missing=[];
    for(const {url,cache} of resources)
      if(cache&&(!keys.includes(cache)||!(await (await caches.open(cache)).match(url))?.ok))missing.push(url);
    return missing;
  },resources);
}
