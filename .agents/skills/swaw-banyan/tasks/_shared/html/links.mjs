import {localReference} from '../output.mjs';
import {stripRawText} from './blocks.mjs';
import {extractStartTags,extractTagAttribute} from './markup.mjs';

export function inspectInternalLinks(pages,{siteURL,files=[]}) {
  const site=new URL(siteURL),content=new Map(pages.map(page=>[page.relativePath,stripRawText(page.text)]));
  const prefix=decodeURIComponent(site.pathname);
  const ids=new Map([...content].map(([file,text])=>[file,new Set(
    extractStartTags(text).flatMap(tag=>[
      extractTagAttribute(tag,'id'),/^<a(?=[\s/>])/i.test(tag)?extractTagAttribute(tag,'name'):''
    ]).filter(Boolean))]));
  const published=new Set([...content.keys(),...files]),issues=[];
  for(const [page,text] of content)for(const tag of extractStartTags(text,'a')) {
    const href=extractTagAttribute(tag,'href');
    if(!href)continue;
    try {
      const url=new URL(href,new URL(page,site));
      if(!['http:','https:'].includes(url.protocol)||url.origin!==site.origin)continue;
      let file=localReference(url.href,{siteURL});
      if(!published.has(file)&&published.has(file+'/index.html'))file+='/index.html';
      if(!decodeURIComponent(url.pathname).startsWith(prefix)||!published.has(file)) {
        issues.push(`Missing internal target: ${page} -> ${href}`);continue;
      }
      if(!url.hash||!ids.has(file))continue;
      const fragment=url.hash.slice(1).split(':~:')[0],fields=new URLSearchParams(fragment);
      const anchor=fields.has('anchor')?fields.get('anchor'):
        fields.has('from')||fields.has('sort')||fields.has('sorts')?'':decodeURIComponent(fragment);
      if(anchor&&!ids.get(file).has(anchor))issues.push(`Missing internal anchor: ${page} -> ${href}`);
    } catch {
      issues.push(`Invalid internal link: ${page} -> ${href}`);
    }
  }
  return issues;
}
