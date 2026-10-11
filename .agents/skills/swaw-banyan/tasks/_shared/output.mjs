import fs from 'node:fs/promises';
import path from 'node:path';

export async function filesUnder(directory, accepts = () => true) {
  const root = path.resolve(directory);
  const files = [];
  async function visit(current) {
    for (const item of await fs.readdir(current,{withFileTypes:true})) {
      const file = path.join(current,item.name);
      if (item.isDirectory()) await visit(file);
      else if (item.isFile() && accepts(file)) files.push(file);
    }
  }
  await visit(root);
  return files.sort();
}

export async function readOptional(file) {
  try { return await fs.readFile(file,'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
}

export async function isFile(file) {
  try { return (await fs.stat(file)).isFile(); }
  catch (error) { if (['ENOENT','ENOTDIR'].includes(error.code)) return false; throw error; }
}

export function relativeName(root,file) {
  return path.relative(root,file).split(path.sep).join('/');
}

export function insideOutput(root,relative) {
  if (!relative || /[\\\0]/.test(relative) || relative.split('/').includes('..')) {
    throw new Error('Invalid output reference: ' + relative);
  }
  const absoluteRoot = path.resolve(root);
  const file = path.resolve(absoluteRoot,relative);
  const remainder = path.relative(absoluteRoot,file);
  if (remainder.startsWith('..' + path.sep) || remainder === '..' || path.isAbsolute(remainder)) {
    throw new Error('Output reference leaves the output directory: ' + relative);
  }
  return file;
}

export function localReference(href,{siteURL = '',page = 'index.html'} = {}) {
  if (!href || href.startsWith('#') || /^(?:data|javascript|mailto|tel):/i.test(href)) return null;
  const base = siteURL ? new URL(page,siteURL) : new URL(page,'https://output.invalid/');
  const url = new URL(href,base);
  if (!['http:','https:'].includes(url.protocol) || url.origin !== base.origin) return null;
  let pathname = decodeURIComponent(url.pathname);
  const prefix = siteURL ? new URL(siteURL).pathname : '/';
  if (prefix !== '/' && pathname.startsWith(prefix)) pathname = pathname.slice(prefix.length);
  const relative = pathname.replace(/^\/+/, '');
  return relative.endsWith('/') || !relative ? relative + 'index.html' : relative;
}
