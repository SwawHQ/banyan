import {checkDestination, checkRedirectSource} from '../../_shared/validation.mjs';

export function parseCloudflareRedirects(text) {
  if (typeof text !== 'string') throw new Error('_redirects must be text.');
  const rules = [];
  let staticCount = 0, dynamicCount = 0;
  for (const [index, raw] of text.replace(/\r\n/g, '\n').split('\n').entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (raw.length > 1000) throw new Error('_redirects line ' + (index + 1) + ' exceeds 1000 characters.');
    if (/[\x00-\x08\x0b-\x1f\x7f]/.test(raw)) throw new Error('_redirects line ' + (index + 1) + ' contains control characters.');
    const fields = line.split(/[ \t]+/);
    if (fields.length !== 3 || !['301', '302'].includes(fields[2])) {
      throw new Error('_redirects line ' + (index + 1) + ' requires source, destination and status 301 or 302.');
    }
    const [source, destination, code] = fields;
    checkRedirectSource(source, '_redirects source');
    checkDestination(destination, '_redirects destination');
    if (source.includes('*') || source.includes(':')) dynamicCount += 1;
    else staticCount += 1;
    rules.push({source, destination, status: Number(code)});
  }
  if (staticCount > 2000 || dynamicCount > 100) throw new Error('_redirects exceeds 2000 static or 100 dynamic redirects.');
  return rules;
}
