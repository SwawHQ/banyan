import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readPages,publishedURL} from '../../_shared/html/read.mjs';
import {extractTagAttribute} from '../../_shared/html/markup.mjs';
import {localReference,insideOutput} from '../../_shared/output.mjs';
export async function inspect(directory) {
  const {root,pages} = await readPages(directory), siteURL = await publishedURL(root);
  const issues = [], checked = new Set();
  for (const page of pages) {
    for (const [tag] of page.text.matchAll(/<script\b[^>]*>/gi)) {
      const src = extractTagAttribute(tag,'src'), integrity = extractTagAttribute(tag,'integrity');
      if (!src || !integrity || checked.has(src + ':' + integrity)) continue;
      checked.add(src + ':' + integrity);
      const relative = localReference(src,{siteURL,page:page.relativePath});
      if (!relative) continue;
      const file = insideOutput(root,relative), actual = fs.realpathSync(file);
      const escaped = path.relative(fs.realpathSync(root),actual);
      if (escaped === '..' || escaped.startsWith('..' + path.sep) || path.isAbsolute(escaped)) throw new Error('Script reference leaves output: ' + src);
      const bytes = fs.readFileSync(actual);
      if (!integrity.split(/\s+/).some(token => {
        const [algorithm,digest] = token.split('-',2);
        return ['sha256','sha384','sha512'].includes(algorithm) && createHash(algorithm).update(bytes).digest('base64') === digest;
      })) issues.push('Script integrity differs from published bytes: ' + src);
    }
  }
  return {issues};
}
