import {imagePages,imageBytes} from '../../../_shared/img.mjs';
import {extractStartTags,extractTagAttribute} from '../../../_shared/html/markup.mjs';
export async function inspect(directory) {
  const {root,pages,siteURL} = await imagePages(directory), issues = [];
  for (const page of pages) for (const tag of extractStartTags(page.text,'img')) {
    if (!extractTagAttribute(tag,'class').split(/\s+/).some(name => ['icon--image','md-inline-image'].includes(name))) continue;
    const src = extractTagAttribute(tag,'src');
    if (!/^\/(?!\/).+\.[a-f0-9]{64}\.[^/?#]+$/.test(src) || !await imageBytes(root,src,siteURL)) {
      issues.push(`${page.relativePath}: image icon must reference an existing hashed resource, got ${src}`);
    }
    if (!extractTagAttribute(tag,'width') || !extractTagAttribute(tag,'height')) issues.push(page.relativePath + ': image icon should reserve its dimensions');
  }
  return {issues};
}
