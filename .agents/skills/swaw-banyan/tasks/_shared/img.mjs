import fs from 'node:fs/promises';
import path from 'node:path';
import {localReference,insideOutput} from './output.mjs';
import {readPages,publishedURL} from './html/read.mjs';
export async function imagePages(directory) {
  const result = await readPages(directory);
  return {...result,siteURL:await publishedURL(result.root)};
}
export function generatedImage(href,siteURL) {
  const relative = localReference(href,{siteURL});
  return relative && relative.startsWith('media/content/') && /\.(?:jpe?g|png|webp)$/i.test(relative);
}
export async function imageBytes(root,href,siteURL) {
  const relative = localReference(href,{siteURL});
  if (!relative) return null;
  const file = insideOutput(root,relative);
  try {
    const real = await fs.realpath(file), remainder = path.relative(await fs.realpath(root),real);
    if (remainder === '..' || remainder.startsWith('..'+path.sep) || path.isAbsolute(remainder)) throw new Error('Image reference leaves output: '+href);
    return await fs.readFile(real);
  } catch (error) { if (['ENOENT','ENOTDIR'].includes(error.code)) return null; throw error; }
}
export function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda || offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && length >= 7) {
      return {height:bytes.readUInt16BE(offset+3),width:bytes.readUInt16BE(offset+5)};
    }
    offset += length;
  }
  return null;
}
