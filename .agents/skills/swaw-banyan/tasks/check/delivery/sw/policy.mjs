import {compilePath} from '../_shared/path.mjs';
import {checkObject, parseJson} from '../_shared/validation.mjs';

export function parseSwPolicy(text) {
  const routes = parseJson(text, 'sw-policy.json');
  if (!Array.isArray(routes)) throw new Error('sw-policy.json must be an array.');
  for (const route of routes) {
    checkObject(route, ['path', 'bucket'], 'sw-policy.json route');
    compilePath(route.path);
    if (!['versioned', 'fingerprinted', 'off'].includes(route.bucket)) {
      throw new Error('sw-policy.json bucket must be versioned, fingerprinted or off.');
    }
  }
  return routes;
}
