import {parseHeaders} from '../../../../_shared/headers.mjs';
import {compilePath} from '../../_shared/path.mjs';
import {checkHeaderName, checkString} from '../../_shared/validation.mjs';

export function parseCloudflareHeaders(text) {
  if (typeof text !== 'string') throw new Error('_headers must be text.');
  for (const [index, line] of text.replace(/\r\n/g, '\n').split('\n').entries()) {
    if (line.length > 2000) throw new Error('_headers line ' + (index + 1) + ' exceeds 2000 characters.');
    if (/[\x00-\x1f\x7f]/.test(line.replace(/^[ \t]+/, ''))) {
      throw new Error('_headers line ' + (index + 1) + ' contains control characters.');
    }
  }
  const rules = parseHeaders(text);
  if (rules.length > 100) throw new Error('_headers exceeds 100 rules.');
  for (const rule of rules) {
    compilePath(rule.source);
    if (!rule.headers.length && !rule.unset?.length) throw new Error('_headers rule ' + rule.source + ' has no headers.');
    for (const key of rule.unset ?? []) checkHeaderName(key, '_headers unset name');
    for (const {key, value} of rule.headers) {
      checkHeaderName(key, '_headers header name');
      checkString(value, '_headers ' + key);
    }
  }
  return rules;
}
