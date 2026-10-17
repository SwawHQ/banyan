import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {filesUnder,relativeName,localReference} from '../../../_shared/output.mjs';
import {extractExternalScriptSrcs} from '../../../_shared/html/markup.mjs';
import {publishedURL} from '../../../_shared/html/read.mjs';
import {gzipBytes} from '../../../_shared/size.mjs';
export async function measureJs(root,pages) {
  const assets = [];
  for (const file of await filesUnder(root,file => path.extname(file) === '.js')) {
    const bytes = await fs.readFile(file);
    const relativePath = relativeName(root,file);
    assets.push({relativePath,rawBytes:bytes.length,gzipBytes:gzipBytes(bytes),pages:0,
      hash:createHash('sha256').update(bytes).digest('hex'),
      family:relativePath.replace(/\.[0-9a-f]{16,}(?=\.[^.]+$)/i,'').replace(/\.min(?=\.js$)/i,'')});
  }
  const byPath = new Map(assets.map(asset => [asset.relativePath,asset]));
  const siteURL = await publishedURL(root), costs = new Map();
  for (const page of pages) {
    const dependencies = new Set(extractExternalScriptSrcs(page.text).map(ref => localReference(ref,{siteURL,page:page.relativePath})).filter(Boolean));
    let raw = 0, gzip = 0;
    for (const ref of dependencies) {
      const asset = byPath.get(ref);
      if (!asset) continue;
      asset.pages++; raw += asset.rawBytes; gzip += asset.gzipBytes;
    }
    costs.set(page.relativePath,{raw,gzip,dependencies:[...dependencies]});
  }
  return {assets,costs};
}
