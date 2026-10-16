import {cloudflareHeaders} from '../../../_shared/headers.mjs';

export function immutable(value) {
  return value.split(',').some(part=>part.trim().toLowerCase()==='immutable');
}

export function classify(outputs,pathname) {
  const result=[];
  if(outputs.sw!==null) {
    const rule=outputs.sw.find(rule=>rule.pattern.test(pathname));
    result.push({channel:'SW',fingerprinted:rule?.bucket==='fingerprinted',
      rules:rule?[rule.path]:[]});
  }
  if(outputs.cloudflare!==null) {
    const rules=outputs.cloudflare.filter(rule=>rule.pattern.test(pathname));
    const headers=cloudflareHeaders(rules,pathname);
    result.push({channel:'Cloudflare Pages',fingerprinted:immutable(headers['cache-control']??''),
      rules:rules.filter(rule=>rule.headers.some(header=>header.key.toLowerCase()==='cache-control')||
        rule.unset?.some(name=>name.toLowerCase()==='cache-control')).map(rule=>rule.source)});
  }
  if(outputs.edgeone!==null) {
    const matches=outputs.edgeone.headers.filter(rule=>rule.pattern.test(pathname));
    const values=matches.flatMap(rule=>rule.headers.filter(header=>header.key.toLowerCase()==='cache-control')
      .map(header=>({source:rule.source,value:header.value})));
    const classifications=new Set(values.map(header=>immutable(header.value)));
    result.push({channel:'EdgeOne Makers',fingerprinted:classifications.size>1?null:immutable(values[0]?.value??''),
      headerOverlap:new Set(values.map(header=>header.value)).size>1,rules:values.map(header=>header.source)});
  }
  return result;
}
