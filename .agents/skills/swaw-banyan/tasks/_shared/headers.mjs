import fs from 'node:fs/promises';
import path from 'node:path';

export function parseHeaders(text) {
  const rules = [];
  let rule;
  for (const raw of text.replace(/\r\n/g,'\n').split('\n')) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(raw)) { rule = {source:raw.trim(),headers:[]}; rules.push(rule); }
    else {
      const offset = raw.indexOf(':');
      if (!rule || offset < 1) throw new Error('Invalid _headers declaration: ' + raw);
      rule.headers.push({key:raw.slice(0,offset).trim(),value:raw.slice(offset+1).trim()});
    }
  }
  return rules;
}
export async function generatedHeaders(directory) {
  const root = path.resolve(directory);
  const text = await fs.readFile(path.join(root,'_headers'),'utf8');
  const edge = JSON.parse(await fs.readFile(path.join(root,'edgeone.json'),'utf8'));
  if (!Array.isArray(edge.headers)) throw new Error('edgeone.json must contain a headers array.');
  return {text:parseHeaders(text),edge:edge.headers};
}
export const headerValues = (rules,source,key) => rules.filter(rule => rule.source === source)
  .flatMap(rule => rule.headers ?? []).filter(header => header.key.toLowerCase() === key.toLowerCase()).map(header => header.value);
