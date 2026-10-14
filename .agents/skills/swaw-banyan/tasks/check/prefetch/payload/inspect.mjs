import {readPages} from '../../../_shared/html/read.mjs';
import {extractInlineScriptTextById,extractExternalScriptSrcs} from '../../../_shared/html/markup.mjs';

const modes=new Set(['off','conservative','moderate','eager','immediate']);
function parsePayload(text) {
  const stats={prefetchPayloadBytes:Buffer.byteLength(text),prefetchRuleCount:0,prefetchPrerenderRuleCount:0,prefetchParseError:''};
  if(!text)return stats;
  try {
    const value=JSON.parse(text);
    if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.enabled!=='boolean'||
      !value.modes||!value.prerender||!value.sw||typeof value.sw.enabled!=='boolean'||
      typeof value.sw.url!=='string'||typeof value.sw.scope!=='string')throw new Error('Invalid unified prefetch configuration');
    for(const key of ['modes','prerender']) {
      const rules=value[key];
      if(typeof rules!=='object'||Array.isArray(rules)||Object.values(rules).some(mode=>!modes.has(mode)))
        throw new Error('Invalid prefetch '+key);
      stats[key==='modes'?'prefetchRuleCount':'prefetchPrerenderRuleCount']=Object.values(rules).filter(mode=>mode!=='off').length;
    }
  }catch(error){stats.prefetchParseError=error.message;}
  return stats;
}
export function prefetchRows(pages) {
  return pages.map(page=>({...page,...parsePayload(extractInlineScriptTextById(page.text,'site-prefetch-data'))}));
}
export async function inspect(directory) {
  const {pages}=await readPages(directory),issues=[];
  for(const row of prefetchRows(pages)) {
    const runtime=extractExternalScriptSrcs(row.text).some(ref=>/\/js\/prefetch\.runtime[^"' >]*\.js/i.test(ref));
    if(row.prefetchParseError)issues.push(`Invalid prefetch payload on ${row.relativePath}: ${row.prefetchParseError}`);
    if(row.prefetchPayloadBytes&&!runtime)issues.push('Missing prefetch runtime bundle on page with prefetch payload: '+row.relativePath);
    if(!row.prefetchPayloadBytes&&runtime)issues.push('Unexpected prefetch runtime bundle without payload: '+row.relativePath);
  }
  return {issues};
}
