import {compilePath} from '../../_shared/path.mjs';
import {checkDestination, checkHeaderName, checkObject, checkRedirectSource, checkString, parseJson} from '../../_shared/validation.mjs';

const buildFields = ['installCommand', 'buildCommand', 'outputDirectory', 'nodeVersion', 'hugoVersion'];

export function parseEdgeoneConfig(text) {
  const config = parseJson(text, 'edgeone.json');
  checkObject(config, [...buildFields, 'headers', 'redirects'], 'edgeone.json');
  for (const key of buildFields) checkString(config[key], 'edgeone.json ' + key);
  if (!Array.isArray(config.headers) || config.headers.length > 30) throw new Error('edgeone.json headers must be an array with at most 30 rules.');
  for (const rule of config.headers) {
    checkObject(rule, ['source', 'headers'], 'edgeone.json header rule');
    compilePath(rule.source);
    if (!Array.isArray(rule.headers) || !rule.headers.length) throw new Error('edgeone.json header rule requires a nonempty headers array.');
    const names = new Set();
    for (const header of rule.headers) {
      checkObject(header, ['key', 'value'], 'edgeone.json header');
      checkHeaderName(header.key, 'edgeone.json header key');
      checkString(header.value, 'edgeone.json ' + header.key);
      if (header.key.length > 100) throw new Error('edgeone.json header key exceeds 100 characters.');
      if (!header.value.length || header.value.length > 1000 || /\p{Script=Han}/u.test(header.value)) {
        throw new Error('edgeone.json header value must contain 1-1000 characters without Chinese characters.');
      }
      const name = header.key.toLowerCase();
      if (names.has(name)) throw new Error('edgeone.json header rule repeats ' + header.key + '.');
      names.add(name);
    }
  }
  if (!Array.isArray(config.redirects) || config.redirects.length > 100) throw new Error('edgeone.json redirects must be an array with at most 100 rules.');
  for (const rule of config.redirects) {
    checkObject(rule, ['source', 'destination', 'statusCode'], 'edgeone.json redirect');
    const hostRedirect = (rule.source === '$host' && rule.destination === '$wwwhost') ||
      (rule.source === '$wwwhost' && rule.destination === '$host');
    if (!hostRedirect) {
      checkRedirectSource(rule.source, 'edgeone.json redirect source');
      checkDestination(rule.destination, 'edgeone.json redirect destination');
    }
    if (rule.source.length > 500 || rule.destination.length > 500) throw new Error('edgeone.json redirect source/destination exceeds 500 characters.');
    if (![301, 302].includes(rule.statusCode)) throw new Error('edgeone.json redirect statusCode must be 301 or 302.');
  }
  return config;
}
