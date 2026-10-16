import fs from 'node:fs/promises';
import path from 'node:path';
import {parseCloudflareHeaders} from '../cloudflare/pages/headers.mjs';
import {parseCloudflareRedirects} from '../cloudflare/pages/redirects.mjs';
import {parseEdgeoneConfig} from '../edgeone/makers/config.mjs';
import {parseSwPolicy} from '../sw/policy.mjs';
import {compilePath} from './path.mjs';

export async function readDeliveryOutputs(directory) {
  const root=path.resolve(directory),issues=[],present=[];
  async function read(name,parse) {
    let text;
    try {text=await fs.readFile(path.join(root,name),'utf8');}
    catch(error) {if(error.code==='ENOENT')return null;throw error;}
    present.push(name);
    try {return parse(text);}
    catch(error) {issues.push(name+': '+error.message);return null;}
  }
  const [cloudflare,redirects,edgeone,sw]=await Promise.all([
    read('_headers',parseCloudflareHeaders),read('_redirects',parseCloudflareRedirects),
    read('edgeone.json',parseEdgeoneConfig),read('sw-policy.json',parseSwPolicy)
  ]);
  if(present.includes('_headers')!==present.includes('_redirects'))issues.push('Cloudflare output must contain both _headers and _redirects.');
  const compile=rules=>rules?.map(rule=>({...rule,pattern:compilePath(rule.source??rule.path)}))??null;
  return {root,present:present.sort(),issues,cloudflare:compile(cloudflare),redirects,
    edgeone:edgeone?{...edgeone,headers:compile(edgeone.headers)}:null,sw:compile(sw)};
}
