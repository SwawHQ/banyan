import fs from 'node:fs/promises';
import path from 'node:path';
import {readPages} from '../../../_shared/html/read.mjs';
import {extractStartTags,extractTagAttribute,extractInlineScriptTextById,extractCanonicalHref,
  extractExternalScriptSrcs,hasClassToken,isRedirectPage} from '../../../_shared/html/markup.mjs';
import {readOptional} from '../../../_shared/output.mjs';

const has=(tag,name)=>new RegExp('(?:^|\\s)'+name+'(?:\\s|=|>)','i').test(tag);
const attr=extractTagAttribute;
const clean=value=>value.replace(/^\/+|\/+$/g,'');

function json(text,id) {
  const value=extractInlineScriptTextById(text,id);
  return value?JSON.parse(value):null;
}

function localPath(href,route,canonical) {
  if(!href||href.startsWith('#'))return null;
  const base=canonical||'https://swban.invalid'+route,url=new URL(href,base);
  return ['http:','https:'].includes(url.protocol)&&url.origin===new URL(base).origin?url.pathname+url.search+url.hash:null;
}

function inspect(page) {
  const route='/'+page.relativePath.split('/').map(encodeURIComponent).join('/').replace(/(?:^|\/)index\.html$/,'/').replace(/^\//,'');
  const text=page.text,body=extractStartTags(text,'body')[0]??'',canonical=extractCanonicalHref(text);
  const anchors=extractStartTags(text,'a').map(tag=>({tag,href:localPath(attr(tag,'href'),route,canonical)}));
  const roots=anchors.filter(({tag,href})=>href&&has(tag,'data-root-href')).map(({href})=>href);
  const rawSource=attr(body,'data-page-collection-source'),source=rawSource?JSON.parse(rawSource):null;
  const rawModels=attr(body,'data-entry-breadcrumb-sources'),models=rawModels?JSON.parse(rawModels):[];
  const rootHref=models.find(model=>model.logicalPath===source?.logicalPath)?.rootItem?.href;
  const names=extractStartTags(text,'div').filter(tag=>has(tag,'data-list-item'))
    .map(tag=>({name:attr(tag,'data-sort-name'),group:attr(tag,'data-sort-group')||'0'})).filter(row=>row.name);
  // This leaf checks selected visible roots; hidden collections are valid sites.
  const sortable=Boolean(source?.logicalPath&&rootHref&&roots.includes(localPath(rootHref,route,canonical))&&has(text,'data-sortable')&&
    names.some((row,i)=>names.some((other,j)=>i!==j&&row.group===other.group&&row.name!==other.name))&&
    anchors.some(({href})=>href&&[...new URLSearchParams(new URL(href,'https://swban.invalid').hash.slice(1)).values()]
      .some(value=>clean(value)===clean(source.logicalPath))));
  const payload=json(text,'site-prefetch-data'),meta=json(text,'site-prefetch-runtime-meta');
  const entry=payload?.TT,config=typeof entry==='string'?payload[entry]:entry;
  const candidates=anchors.map(anchor=>({...anchor,href:anchor.href?.split('#')[0]})).filter(({tag,href})=>href&&href!==route&&has(tag,'data-prefetch-slot')&&
    !has(tag,'download')&&(!attr(tag,'target')||attr(tag,'target').toLowerCase()==='_self')&&
    /^(link|sw)_[smx]f(?:_g)?$/.test(config?.[attr(tag,'data-prefetch-slot')]??''));
  const coordinated=meta?.coordination_mode==='preempt_runtime_when_supported'&&meta.owned_slots?.length&&candidates.length;
  const remaining=new Set(candidates.filter(({tag})=>!meta?.owned_slots?.includes(attr(tag,'data-prefetch-slot'))).map(({href})=>href));
  return {route,language:attr(extractStartTags(text,'html')[0]??'','lang'),roots,sortable,
    prose:hasClassToken(text,'prose'),panel:has(text,'data-site-update-panel'),
    version:has(text,'data-site-update-version'),
    worker:extractExternalScriptSrcs(text).some(src=>/\/sw-manager\.enable\./.test(src)),
    overlap:Boolean(coordinated&&candidates.some(({href})=>!remaining.has(href))),
    debug:Boolean(coordinated&&extractStartTags(text,'pre').some(tag=>attr(tag,'id')==='prefetch-debug-support'))};
}

export async function discoverSite(directory) {
  const {root,pages:html}=await readPages(directory);
  const pages=html.filter(page=>!isRedirectPage(page.text)&&!/(?:^|\/)404\.html$/.test(page.relativePath)).map(inspect);
  const home=pages.find(page=>page.route==='/');
  if(!home)throw new Error('Build directory must contain a non-redirect index.html.');
  pages.sort((a,b)=>Number(b.language===home.language)-Number(a.language===home.language)||a.route.length-b.route.length||a.route.localeCompare(b.route));
  const byRoute=new Map(pages.map(page=>[page.route,page]));
  const prose=pages.find(page=>page.prose),collection=pages.find(page=>page.sortable);
  const panel=pages.find(page=>page.panel&&page.version&&page.worker&&page.roots.some(route=>{
    const source=byRoute.get(route);return source&&source.route!==page.route&&source.worker&&source.roots.includes(page.route);
  }));
  const from=panel&&pages.find(page=>page.route!==panel.route&&page.worker&&page.roots.includes(panel.route)&&panel.roots.includes(page.route));
  const collectionFrom=panel&&pages.find(page=>page.sortable&&page.worker&&page.roots.includes(panel.route));
  let ruleFiles=[];
  try {ruleFiles=await fs.readdir(path.join(root,'site','speculation-rules'));}
  catch(error){if(error.code!=='ENOENT')throw error;}
  const rules=ruleFiles.some(file=>file.endsWith('.json'))||/\bSpeculation-Rules\s*:/i.test(await readOptional(path.join(root,'_headers')));
  return {root,pages:pages.length,home:home.route,prose:prose?.route??null,collection:collection?.route??null,
    rules,overlap:rules?pages.find(page=>page.overlap)?.route??null:null,
    debug:rules?pages.find(page=>page.debug)?.route??null:null,
    offline:pages.find(page=>page.worker)?.route??null,panel:panel?.route??null,
    from:from?.route??null,collectionFrom:collectionFrom?.route??null};
}
