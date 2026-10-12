import fs from 'node:fs/promises';
import path from 'node:path';
import {filesUnder} from '../../_shared/output.mjs';
import {readPages,pageState} from '../../_shared/html/read.mjs';
import {decodeHtmlAttribute,extractStartTags,extractTagAttribute} from '../../_shared/html/markup.mjs';
export async function inspect(directory) {
  const {root,pages} = await readPages(directory);
  const files = await filesUnder(root,file => path.basename(file).toLowerCase() === 'sitemap.xml');
  const locs = new Set(), issues = [];
  for (const file of files) {
    const text = await fs.readFile(file,'utf8');
    for (const match of text.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)) locs.add(decodeHtmlAttribute(match[1].trim()));
  }
  if (!files.length) issues.push('Missing sitemap.xml.');
  for (const page of pages.map(pageState)) {
    if (page.isRedirect || !page.canonicalHref) continue;
    const disabled = extractStartTags(page.text,'html').some(tag => extractTagAttribute(tag,'data-sitemap-disabled') === 'true');
    if (disabled && locs.has(page.canonicalHref)) issues.push(`Sitemap-disabled page must not appear as a sitemap loc: ${page.relativePath}`);
    if (page.isNoindex && locs.has(page.canonicalHref)) issues.push(`Noindex page must not appear as a sitemap loc: ${page.relativePath}`);
    if (!disabled && !page.isNoindex && !locs.has(page.canonicalHref)) issues.push(`Indexable page must appear as a sitemap loc: ${page.relativePath}`);
  }
  return {issues};
}
