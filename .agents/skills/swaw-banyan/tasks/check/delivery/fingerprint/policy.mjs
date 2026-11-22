import {cloudflareHeaders} from '../../../_shared/headers.mjs';

export function immutable(value) {
  return value.split(',').some(part=>part.trim().toLowerCase()==='immutable');
}

export function expectsFingerprint(outputs,pathname) {
  if(outputs.sw?.find(rule=>rule.pattern.test(pathname))?.bucket==='fingerprinted')return true;
  if(outputs.cloudflare && immutable(cloudflareHeaders(outputs.cloudflare,pathname)['cache-control']??''))return true;
  let cacheControl='';
  for(const rule of outputs.edgeone?.headers??[]) {
    if(!rule.pattern.test(pathname))continue;
    for(const {key,value} of rule.headers)if(key.toLowerCase()==='cache-control')cacheControl=value;
  }
  return immutable(cacheControl);
}
