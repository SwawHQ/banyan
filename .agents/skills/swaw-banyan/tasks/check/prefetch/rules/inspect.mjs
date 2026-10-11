import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {generatedHeaders,headerValues} from '../../../_shared/headers.mjs';
import {filesUnder,insideOutput,relativeName} from '../../../_shared/output.mjs';
export function ruleIssues(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).some(key => !['prefetch','prerender'].includes(key))) return ['Speculation rules must be a prefetch/prerender object.'];
  const issues = [];
  for (const [kind,rules] of Object.entries(value)) {
    if (!Array.isArray(rules) || rules.some(rule => !rule || rule.source !== 'document' || !rule.where)) issues.push('Invalid shared document rules: ' + kind);
  }
  return issues;
}
export async function inspect(directory) {
  const root = path.resolve(directory), policies = await generatedHeaders(root), issues = [];
  const a = headerValues(policies.text,'/*','Speculation-Rules'), b = headerValues(policies.edge,'/*','Speculation-Rules');
  if (a.length > 1 || b.length > 1 || JSON.stringify(a) !== JSON.stringify(b)) issues.push('Generated Speculation-Rules headers must agree and appear at most once.');
  const files = (await filesUnder(root,file => path.extname(file) === '.json')).filter(file => relativeName(root,file).startsWith('speculation-rules/'));
  if (!a.length && !b.length) {
    if (files.length || [...policies.text,...policies.edge].some(rule => rule.source.includes('/speculation-rules/'))) issues.push('Disabled speculation rules must not publish stale files or header routes.');
    return {issues};
  }
  const match = (a[0] ?? '').match(/^"\/speculation-rules\/document\.([a-f0-9]{64})\.json"$/);
  if (!match) issues.push('Speculation-Rules must reference one fingerprinted shared JSON document.');
  else {
    const relative = 'speculation-rules/document.' + match[1] + '.json';
    const bytes = await fs.readFile(insideOutput(root,relative));
    if (files.length !== 1 || relativeName(root,files[0]) !== relative) issues.push('Publish exactly one shared speculation rules file.');
    if (createHash('sha256').update(bytes).digest('hex') !== match[1]) issues.push('Speculation rules fingerprint differs from published bytes.');
    issues.push(...ruleIssues(JSON.parse(bytes.toString('utf8'))));
  }
  return {issues};
}
