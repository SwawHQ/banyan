import fs from 'node:fs/promises';
import path from 'node:path';
import {parse as parseToml} from './_vendor/toml.mjs';
import {parse as parseYaml} from './_vendor/yaml.mjs';
import {readHugoConfig} from './hugo.mjs';
import {filesUnder,relativeName} from './output.mjs';

function jsonPrefix(text) {
  let depth = 0, quoted = false, escaped = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') { if (--depth === 0) return text.slice(0,index + 1); }
  }
  throw new Error('Unclosed JSON front matter.');
}
function frontMatter(text) {
  const normalized = text.replace(/^\uFEFF/,'');
  let value = {};
  if (/^(?:---|\+\+\+)\r?\n/.test(normalized)) {
    const delimiter = normalized.startsWith('---') ? '---' : '+++';
    const lines = normalized.split(/\r?\n/), end = lines.findIndex((line,index) => index > 0 && line.trim() === delimiter);
    if (end < 0) throw new Error('Unclosed front matter.');
    const body = lines.slice(1,end).join('\n');
    value = delimiter === '---' ? parseYaml(body) ?? {} : parseToml(body);
  } else if (normalized.startsWith('{')) value = JSON.parse(jsonPrefix(normalized));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Front matter must be an object.');
  return Object.fromEntries(Object.entries(value).map(([key,value]) => [key.toLowerCase(),value]));
}
export async function readContent(site) {
  const root = path.resolve(site), config = readHugoConfig(root), sources = new Set();
  for (const mount of config.module?.mounts ?? []) {
    if ((mount.target ?? '').replaceAll('\\','/').split('/')[0] === 'content') sources.add(path.resolve(root,mount.source));
  }
  // These are the consuming site's mounts. Imported modules remain Hugo-owned.
  const files = new Set(), issues = [];
  for (const source of sources) {
    let stat;
    try { stat = await fs.stat(source); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const candidates = stat.isDirectory() ? await filesUnder(source) : [source];
    for (const file of candidates) if (/\.(?:md|markdown|html)$/i.test(file)) files.add(file);
  }
  const records = [];
  for (const file of [...files].sort()) {
    const relativePath = relativeName(root,file);
    try { records.push({relativePath,data:frontMatter(await fs.readFile(file,'utf8'))}); }
    catch (error) { issues.push(`Invalid front matter in ${relativePath}: ${error.message}`); }
  }
  return {records,issues};
}
