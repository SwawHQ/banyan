import fs from 'node:fs/promises';
import path from 'node:path';

export function parseHeaders(text) {
  const rules = [];
  let rule;
  for (const raw of text.replace(/\r\n/g,'\n').split('\n')) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(raw)) { rule = {source:raw.trim(),headers:[]}; rules.push(rule); }
    else {
      const unset = raw.trim().match(/^!\s+([!#$%&'*+.^_\x60|~0-9A-Za-z-]+)$/);
      if (rule && unset) { (rule.unset ??= []).push(unset[1]); continue; }
      const offset = raw.indexOf(':');
      if (!rule || offset < 1) throw new Error('Invalid _headers declaration: ' + raw);
      rule.headers.push({key:raw.slice(0,offset).trim(),value:raw.slice(offset+1).trim()});
    }
  }
  return rules;
}
export function cloudflareHeaders(rules,pathname,defaults={}) {
  const headers = Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key.toLowerCase(),value]));
  const attached = new Set();
  for (const rule of rules) {
    const pattern = rule.pattern ?? new RegExp('^'+rule.source.split('*')
      .map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$');
    if (!pattern.test(pathname)) continue;
    for (const key of rule.unset ?? []) {
      delete headers[key.toLowerCase()];attached.delete(key.toLowerCase());
    }
    for (const {key,value} of rule.headers) {
      const name = key.toLowerCase();
      headers[name] = attached.has(name) ? headers[name]+', '+value : value;
      attached.add(name);
    }
  }
  return headers;
}
export async function generatedHeaders(directory) {
  const root = path.resolve(directory);
  async function read(name) {
    try {return await fs.readFile(path.join(root,name),'utf8');}
    catch(error) {if(error.code==='ENOENT')return null;throw error;}
  }
  const [text,body]=await Promise.all([read('_headers'),read('edgeone.json')]);
  const edge=body===null?null:JSON.parse(body);
  if (body!==null&&(!edge||!Array.isArray(edge.headers))) throw new Error('edgeone.json must contain a headers array.');
  return {text:text===null?null:parseHeaders(text),edge:edge?.headers??null};
}
export const headerValues = (rules,source,key) => (rules??[]).filter(rule => rule.source === source)
  .flatMap(rule => rule.headers ?? []).filter(header => header.key.toLowerCase() === key.toLowerCase()).map(header => header.value);
