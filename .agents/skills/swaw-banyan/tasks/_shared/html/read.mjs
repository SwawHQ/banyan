import fs from 'node:fs/promises';
import path from 'node:path';
import {filesUnder,relativeName,readOptional} from '../output.mjs';
import {extractCanonicalHref,isRedirectPage,extractMetaContent} from './markup.mjs';

export async function readPages(directory) {
  const root = path.resolve(directory);
  const files = await filesUnder(root,file => path.extname(file).toLowerCase() === '.html');
  if (!files.length) throw new Error('No HTML files found under: ' + root);
  const pages = [];
  for (const file of files) {
    const buffer = await fs.readFile(file);
    pages.push({absolutePath:file,relativePath:relativeName(root,file),text:buffer.toString('utf8'),buffer});
  }
  return {root,pages};
}

export function pageState(page) {
  return {
    ...page,
    isRedirect:isRedirectPage(page.text),
    isNoindex:extractMetaContent(page.text,'robots').toLowerCase().split(/[\s,]+/).some(token => token === 'noindex' || token === 'none'),
    canonicalHref:extractCanonicalHref(page.text)
  };
}

export async function publishedURL(root) {
  const text = await readOptional(path.join(root,'index.html'));
  const href = extractCanonicalHref(text);
  if (!href) throw new Error('Published home page must declare its canonical URL.');
  const url = new URL(href);
  if (!['http:','https:'].includes(url.protocol)) throw new Error('Canonical URL must use HTTP or HTTPS.');
  return url.href;
}
