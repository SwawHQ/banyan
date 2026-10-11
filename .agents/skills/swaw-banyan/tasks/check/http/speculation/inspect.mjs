import {createHash} from 'node:crypto';
import {request} from '../../../_shared/http.mjs';
import {ruleIssues} from '../../prefetch/rules/inspect.mjs';
export async function inspect(url) {
  const response = await request(url), value = response.headers.get('speculation-rules'), issues = [];
  if (!value) return {issues};
  const match = value.match(/^"([^"]+)"$/);
  if (!match) return {issues:['Speculation-Rules must reference one quoted rules URL.']};
  const target = new URL(match[1],response.url);
  const fingerprint = target.pathname.match(/\/speculation-rules\/document\.([a-f0-9]{64})\.json$/)?.[1];
  if (target.origin !== new URL(response.url).origin || !fingerprint) return {issues:['Speculation-Rules must reference a generated same-origin rules file.']};
  const ruleResponse = await request(target.href,'GET');
  const bytes = Buffer.from(await ruleResponse.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== fingerprint) issues.push('Speculation rules fingerprint differs from response bytes.');
  issues.push(...ruleIssues(JSON.parse(bytes.toString('utf8'))));
  return {issues};
}
