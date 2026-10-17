import {imagePages,imageBytes,generatedImage} from '../../../_shared/img.mjs';
import {extractTagAttribute} from '../../../_shared/html/markup.mjs';
import {readHugoConfig} from '../../../_shared/hugo.mjs';
export async function inspect(directory) {
  const {root,pages,siteURL} = await imagePages(directory), issues = [], configs = new Map();
  let baseConfig;
  for (const page of pages) {
    const language = extractTagAttribute(page.text.match(/<html\b[^>]*>/i)?.[0] ?? '','lang');
    const stack = [];
    for (const [tag] of page.text.matchAll(/<\/?(?:picture|a|source|img)\b[^>]*>/gi)) {
      const name = tag.match(/^<\/?(\w+)/)[1].toLowerCase();
      if (tag.startsWith('</')) {
        const index = stack.findLastIndex(node => node.name === name);
        if (index >= 0) stack.splice(index);
        continue;
      }
      if (['a','picture'].includes(name)) { stack.push({name,tag,sources:[]}); continue; }
      const picture = stack.findLast(node => node.name === 'picture');
      if (name === 'source') { if (picture) picture.sources.push(tag); continue; }
      const src = extractTagAttribute(tag,'src');
      if (extractTagAttribute(tag,'class').split(/\s+/).some(name => ['icon--image','md-inline-image'].includes(name)) || !generatedImage(src,siteURL)) continue;
      const configKey = language || '';
      if (!configs.has(configKey)) {
        baseConfig ??= await readHugoConfig();
        const matchingKey = Object.keys(baseConfig.languages ?? {}).find(key =>
          key.toLowerCase() === configKey.toLowerCase() || baseConfig.languages[key].languagecode?.toLowerCase() === configKey.toLowerCase());
        const cfg = (matchingKey ? await readHugoConfig(process.cwd(),matchingKey) : baseConfig).params?.media?.responsive_images;
        if (!cfg || !Number.isInteger(cfg.max_width) || cfg.max_width <= 0 || typeof cfg.sizes !== 'string' || !cfg.sizes.trim()) {
          throw new Error('Resolved Hugo params.media.responsive_images must define max_width and sizes.');
        }
        configs.set(configKey,cfg);
      }
      const config = configs.get(configKey), link = stack.findLast(node => node.name === 'a');
      if (!picture || !extractTagAttribute(picture.tag,'class').split(/\s+/).includes('md-responsive-image')) issues.push(page.relativePath + ': content image is not wrapped in picture.md-responsive-image: ' + src);
      if (!link || !extractTagAttribute(link.tag,'class').split(/\s+/).includes('md-image-link')) issues.push(page.relativePath + ': content image is not wrapped in a.md-image-link: ' + src);
      else if (extractTagAttribute(link.tag,'target') !== '_blank' || !extractTagAttribute(link.tag,'rel').split(/\s+/).includes('noopener')) issues.push(page.relativePath + ': content image must open in a safe new tab: ' + src);
      const source = picture?.sources.findLast(source => extractTagAttribute(source,'type') === 'image/webp');
      const srcset = source ? extractTagAttribute(source,'srcset') : '';
      if (!srcset) issues.push(page.relativePath + ': content image is missing a webp source srcset: ' + src);
      else {
        const candidates = srcset.split(',').map(value => value.trim().match(/^(\S+)\s+(\d+)w$/));
        if (candidates.some(value => !value)) issues.push(page.relativePath + ': invalid responsive width candidates: ' + src);
        else {
          const max = Math.max(...candidates.map(value => Number(value[2])));
          const width = Number(extractTagAttribute(tag,'width'));
          if (width > 0 && max !== Math.min(width,config.max_width)) issues.push(`${page.relativePath}: max webp candidate is ${max}w; expected ${Math.min(width,config.max_width)}w`);
          for (const candidate of candidates) if (!await imageBytes(root,candidate[1],siteURL)) issues.push('Missing responsive image candidate: ' + candidate[1]);
        }
      }
      if (!source || extractTagAttribute(source,'sizes') !== config.sizes) issues.push(page.relativePath + ': webp sizes must match resolved Hugo configuration: ' + src);
      if (!extractTagAttribute(tag,'width') || !extractTagAttribute(tag,'height')) issues.push(page.relativePath + ': content image should reserve its dimensions: ' + src);
      if (extractTagAttribute(tag,'loading') !== 'lazy' || extractTagAttribute(tag,'decoding') !== 'async') issues.push(page.relativePath + ': content image should keep lazy async loading: ' + src);
      if (!await imageBytes(root,src,siteURL)) issues.push('Missing generated content image: ' + src);
    }
  }
  return {issues};
}
