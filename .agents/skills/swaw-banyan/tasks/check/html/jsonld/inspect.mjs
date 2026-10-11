import {readPages} from '../../../_shared/html/read.mjs';
import {extractTagAttribute} from '../../../_shared/html/markup.mjs';
function inspectJsonLd(text) {
  const errors = [];
  let blockCount = 0;
  for (const [,attributes,body] of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (extractTagAttribute(attributes,'type').toLowerCase() !== 'application/ld+json') continue;
    blockCount++;
    if (!body.trim()) errors.push(`block ${blockCount} is empty`);
    else { try { JSON.parse(body); } catch (error) { errors.push(`block ${blockCount}: ${error.message}`); } }
  }
  return {jsonLdBlockCount:blockCount,jsonLdErrors:errors};
}
export async function inspect(directory) {
  const {pages} = await readPages(directory);
  return {issues:pages.flatMap(page => inspectJsonLd(page.text).jsonLdErrors.map(error =>
    `Invalid JSON-LD on ${page.relativePath}: ${error}`))};
}
