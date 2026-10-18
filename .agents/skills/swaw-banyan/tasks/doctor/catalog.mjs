import fs from 'node:fs';
import {parseToml as parse} from '../_shared/parsers.mjs';

export const tools=['bun','node','git','go','hugo','gh','uv'];
const ids=new Set(['tool.runtime',...tools.map(name=>'tool.'+name),'tool.python','site.banyan']);
const languages=['en','zh'];
const invalid=field=>{throw new Error('Invalid references/doctor.toml: '+field);};

export function parseCatalog(text) {
  if (Buffer.byteLength(text)>131072) invalid('file is too large');
  const value=parse(text);
  if (value.schema_version!==1||Object.keys(value).some(key=>!['schema_version','checks','hints'].includes(key))) invalid('schema_version');
  function translated(pair,field) {
    if (!pair||Object.keys(pair).some(key=>!languages.includes(key))) invalid(field);
    for (const language of languages) {
      if (typeof pair[language]!=='string'||!pair[language].trim()) invalid(field+'.'+language);
      if (/[{}]/.test(pair[language].replace(/\{(?:module|version)\}/g,''))) invalid(field+' placeholders');
    }
    const parameters=text=>[...new Set(text.match(/\{(?:module|version)\}/g)??[])].sort().join(',');
    if (parameters(pair.en)!==parameters(pair.zh)) invalid(field+' translations');
  }
  if (!value.hints||Object.keys(value.hints).some(key=>!['incomplete','blocked','bindings'].includes(key))) invalid('hints');
  for (const key of ['incomplete','blocked','bindings']) translated(value.hints[key],'hints.'+key);
  if (!value.checks||typeof value.checks!=='object'||Array.isArray(value.checks)) invalid('checks');
  for (const [id,check] of Object.entries(value.checks)) {
    if (!ids.has(id)||!check||typeof check!=='object'||Array.isArray(check)||typeof check.enabled!=='boolean'||Object.keys(check).some(key=>!['enabled','hint'].includes(key))) invalid('checks.'+id);
    translated(check.hint,'checks.'+id+'.hint');
  }
  return value;
}

export function loadCatalog() {
  const file=new URL('../../references/doctor.toml',import.meta.url),stat=fs.lstatSync(file);
  if (!stat.isFile()||stat.isSymbolicLink()||stat.size>131072) invalid('file');
  return parseCatalog(fs.readFileSync(file,'utf8'));
}
