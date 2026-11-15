import fs from 'node:fs';
import path from 'node:path';

const literal=value=>value.replace(/[\\*?\[\]{}<>,:$]/g,'\\$&');
export function sourceGlobs(source,root='') {
  const sources=Array.isArray(source)?source:[source];
  if(!sources.length)throw new Error('Search source array must not be empty.');
  return sources.map(value=>{
    if(typeof value!=='string'||!value||value.startsWith('/')||/[\\:\x00-\x1f]/.test(value)||value.includes('..')||value.startsWith('./'))
      throw new Error('Search source must be a relative HTML glob or directory ending in /.');
    if(value.endsWith('/'))value+='**/*.html';
    if(!value.endsWith('.html'))throw new Error('Search source must be rss, an HTML glob, or a directory ending in /.');
    return literal(root)+value;
  });
}

export function searchArguments(destination) {
  const file=path.join(destination,'site/search-index.json');
  if(!fs.existsSync(file))return null;
  const {base,groups}=JSON.parse(fs.readFileSync(file,'utf8'));
  const selectors=new Set(groups.map(group=>group.selector));
  if(selectors.size!==1||typeof [...selectors][0]!=='string'||![...selectors][0].trim())
    throw new Error('Search pages must use the same nonempty index selector across languages.');
  const prefix=new URL(base).pathname,files=new Set();
  for(const group of groups) {
    if(group.source!=='rss') {
      const root=new URL(group.root,base);
      if(root.origin!==new URL(base).origin||!root.pathname.startsWith(prefix))throw new Error('Search root outside site.');
      const relative=decodeURIComponent(root.pathname.slice(prefix.length));
      if(relative.includes('..')||/[\\:\x00-\x1f]/.test(relative))throw new Error('Invalid search root.');
      for(const glob of sourceGlobs(group.source,relative))files.add(glob);
      continue;
    }
    for(const value of group.urls) {
    const url=new URL(value,base);
    if(url.origin!==new URL(base).origin||!url.pathname.startsWith(prefix))throw new Error('Search URL outside site.');
    let relative=decodeURIComponent(url.pathname.slice(prefix.length));
    if(!relative||relative.endsWith('/'))relative+='index.html';
    if(relative.split('/').some(part=>!part||part==='.'||part==='..')||/[\\\x00-\x1f]/.test(relative)||path.isAbsolute(relative))
      throw new Error('Invalid search file path.');
    const target=fs.realpathSync(path.join(destination,relative)),root=fs.realpathSync(destination);
    if(!target.startsWith(root+path.sep))throw new Error('Search file outside build.');
    // Wax glob metacharacters must remain literal in Hugo-generated filenames.
    files.add(literal(relative));
    }
  }
  if(!files.size)return [];
  const glob=files.size===1?[...files][0]:'{'+[...files].join(',')+'}';
  return ['--site',destination,'--output-subdir','pagefind','--root-selector',[...selectors][0],'--glob',glob];
}
