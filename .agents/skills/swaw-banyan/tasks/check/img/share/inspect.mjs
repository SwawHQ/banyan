import {imagePages,imageBytes,jpegDimensions,generatedImage} from '../../../_shared/img.mjs';
import {extractStartTags,extractTagAttribute} from '../../../_shared/html/markup.mjs';
export async function inspect(directory) {
  const {root,pages,siteURL} = await imagePages(directory), issues = [], warnings = [], seen = new Set();
  for (const page of pages) for (const tag of extractStartTags(page.text,'meta')) {
    const kind = extractTagAttribute(tag,'property') || extractTagAttribute(tag,'name');
    const src = extractTagAttribute(tag,'content');
    if (!['og:image','twitter:image'].includes(kind) || !generatedImage(src,siteURL) || seen.has(src)) continue;
    seen.add(src);
    if (!/\.jpe?g$/i.test(new URL(src,siteURL).pathname)) {
      issues.push(`${page.relativePath}: ${kind} should use generated jpg share image, got ${src}`); continue;
    }
    const bytes = await imageBytes(root,src,siteURL);
    if (!bytes) { issues.push('Missing generated share image: ' + src); continue; }
    const dimensions = jpegDimensions(bytes);
    if (!dimensions) issues.push('Generated share image is not a readable JPEG: ' + src);
    else if (Math.abs(dimensions.width/dimensions.height - 1200/630)/(1200/630) > 0.08) {
      warnings.push(`Share image ratio is ${dimensions.width}x${dimensions.height}, outside the 1200x630 target: ${src}`);
    }
  }
  return {issues,warnings};
}
