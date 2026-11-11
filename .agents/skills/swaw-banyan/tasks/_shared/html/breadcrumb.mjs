import fs from 'node:fs';
import path from 'node:path';
import {insideOutput,localReference} from '../output.mjs';
import {decodeHtmlAttribute,extractCanonicalHref,extractStartTags,extractTagAttribute,hasClassToken,isRedirectPage} from './markup.mjs';
import {extractBlocks} from './blocks.mjs';

const textContent=html=>decodeHtmlAttribute(html.replace(/<[^>]*>/g,'')).trim();
const localLink=(href,siteURL)=>{
  if(!href)return false;
  try {const url=new URL(href,siteURL);return ['http:','https:'].includes(url.protocol)&&url.origin===new URL(siteURL).origin;}
  catch{return false;}
};

export function readNavigationFragment(text,{siteURL='https://output.invalid/'}={}) {
  const roots=extractBlocks(text,'div',tag=>/\sdata-breadcrumb-column-path(?:\s|=|>)/i.test(tag));
  if(roots.length!==1||roots[0].html.trim()!==text.trim()
    ||!hasClassToken(roots[0].open,'item-list')||!hasClassToken(roots[0].open,'item-list--breadcrumb-column'))
    throw new Error('Expected one navigation fragment root');
  const root=roots[0],logicalPath=extractTagAttribute(root.open,'data-breadcrumb-column-path');
  const sortVariant=extractTagAttribute(root.open,'data-sort-variant'),defaultSort=extractTagAttribute(root.open,'data-default-sort');
  const sortFields={name:['name'],section:['name','date','count'],all:['name','date','size'],products:['name','date','price']};
  if(!/^\/(?!\/).+\/$/.test(logicalPath)
    ||(sortVariant?(!sortFields[sortVariant]?.includes(defaultSort.split('-')[0])
      ||!/^[a-z]+-(?:asc|desc)$/.test(defaultSort)):defaultSort!==''))
    throw new Error('Invalid navigation fragment metadata');
  for(const match of text.matchAll(/<([a-z][\w:-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)) {
    const nodeName=match[1].toLowerCase();
    if(!['div','span','a','bdi','svg','use','img'].includes(nodeName))
      throw new Error('Unexpected navigation fragment element: '+match[1]);
    const attributes=match[0].replace(/^<[\w:-]+/,'').replace(/\/?\s*>$/,'');
    for(const attribute of attributes.matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>\x60]+))?/g)) {
      const name=attribute[1].toLowerCase();
      if(!/^(?:class|title|href|src|alt|width|height|decoding|focusable|role|aria-[\w-]+|data-[\w-]+)$/.test(name))
        throw new Error('Unexpected navigation fragment attribute: '+name);
    }
    for(const name of ['href','src']) {
      if(!new RegExp('\\s'+name+'(?:\\s|=|>)','i').test(match[0]))continue;
      const href=extractTagAttribute(match[0],name);
      if(!localLink(href,siteURL)||(name==='href'&&(!['a','use'].includes(nodeName)||(nodeName==='use'&&!href.startsWith('#'))))
        ||(name==='src'&&(nodeName!=='img'||!/^\/(?!\/)/.test(href))))
        throw new Error('Invalid or cross-origin navigation fragment link');
    }
  }
  const header=extractBlocks(root.inner,'div')[0];
  if(!header||root.inner.slice(0,header.index).trim()||!/\sdata-list-header(?:\s|=|>)/i.test(header.open))
    throw new Error('Navigation fragment needs its header first');
  const href=extractTagAttribute(root.open,'data-collection-href'),label=extractTagAttribute(root.open,'aria-label').trim();
  if(!label||extractTagAttribute(root.open,'role')!=='group'||!localLink(href,siteURL))
    throw new Error('Invalid navigation fragment label or collection URL');
  if(sortVariant) {
    const controls=extractBlocks(header.inner,'a',tag=>/\sdata-breadcrumb-sort-toggle(?:\s|=|>)/i.test(tag));
    if(controls.length!==1||!hasClassToken(controls[0].inner,'breadcrumb-sort-label')
      ||!extractStartTags(controls[0].inner,'span').some(tag=>/\sdata-sort-indicator(?:\s|=|>)/i.test(tag)))
      throw new Error('Navigation fragment needs a complete sort control');
  }
  const seen=new Set();
  const rows=extractBlocks(root.inner,'div',tag=>/\sdata-list-item(?:\s|=|>)/i.test(tag)).map(block=>{
    const links=extractBlocks(block.inner,'a',tag=>/\sdata-list-entry(?:\s|=|>)/i.test(tag));
    const titles=extractBlocks(block.inner,'span',tag=>hasClassToken(tag,'item-title'));
    const kind=extractTagAttribute(block.open,'data-kind');
    if(links.length!==1||titles.length!==1||!kind)throw new Error('Invalid navigation fragment row');
    const href=extractTagAttribute(links[0].open,'href'),text=textContent(titles[0].inner);
    if(!text||!localLink(href,siteURL)||seen.has(href))throw new Error('Invalid or duplicate navigation fragment row link');
    seen.add(href);
    const row={kind,href,text};
    for(const field of ['name','date','count','size','price'])
      if(new RegExp('\\sdata-sort-'+field+'(?:\\s|=|>)', 'i').test(block.open))row['sort_'+field]=extractTagAttribute(block.open,'data-sort-'+field);
    const title=extractTagAttribute(links[0].open,'title');if(title&&title!==text)row.title=title;
    const icons=extractBlocks(block.inner,'span',tag=>hasClassToken(tag,'icon--text'));
    const image=extractStartTags(block.inner,'img')[0],use=extractStartTags(block.inner,'use')[0];
    if(icons.length)row.icon={text:textContent(icons[0].inner)};
    else if(image)row.icon={image:extractTagAttribute(image,'src'),...(hasClassToken(image,'icon--monochrome')?{monochrome:true}:{})};
    else if(use){const icon=extractTagAttribute(use,'href');if(icon.startsWith('#icon-'))row.icon=icon.slice(6);}
    return row;
  });
  return {provider:'collection',logicalPath,href,label,sortVariant,defaultSort,rows};
}

function readColumn(href,logicalPath,{directory,pagePath,cache}) {
  const root=path.resolve(directory),siteKey='site:'+root;
  if(!cache.has(siteKey)) {
    const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
    let siteURL=extractCanonicalHref(home)||'https://output.invalid/';
    const lang=extractTagAttribute(extractStartTags(home,'html')[0]||'','lang');
    const url=new URL(siteURL);
    // Hugo's root language redirect names the language home, not the publish root.
    if(isRedirectPage(home)&&lang&&url.pathname.endsWith('/')
      &&decodeURIComponent(url.pathname.split('/').at(-2))===lang)
      siteURL=new URL('../',url).href;
    cache.set(siteKey,siteURL);
  }
  const siteURL=cache.get(siteKey),base=new URL(siteURL),url=new URL(href,new URL(pagePath||'index.html',base));
  if(!['http:','https:'].includes(url.protocol)||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))
    throw new Error('Breadcrumb column URL leaves the published site: '+href);
  const file=insideOutput(root,localReference(href,{siteURL,page:pagePath||'index.html'}));
  if(!cache.has(file)) {
    let real;
    try {real=fs.realpathSync(file);} catch(cause) {
      throw new Error('Cannot read breadcrumb column '+href+': '+cause.code);
    }
    const remainder=path.relative(fs.realpathSync(root),real);
    if(remainder==='..'||remainder.startsWith('..'+path.sep)||path.isAbsolute(remainder))
      throw new Error('Breadcrumb column URL leaves the output directory: '+href);
    try {cache.set(file,readNavigationFragment(fs.readFileSync(real,'utf8'),{siteURL}));} catch(cause) {
      throw new Error('Invalid breadcrumb column fragment '+href+': '+cause.message);
    }
  }
  const payload=cache.get(file);
  if(payload.logicalPath!==logicalPath)throw new Error('Invalid breadcrumb column fragment for '+logicalPath+': '+href);
  return payload;
}

export function normalizeLogicalPath(value) {
  try {value=decodeURIComponent(value);} catch {}
  const parts=value.split('/').filter(Boolean);return parts.length?'/'+parts.join('/')+'/':'';
}

export function readBreadcrumbData(text,{directory,pagePath,cache=new Map()}={}) {
  const body=extractStartTags(text,'body')[0]||'',navigationText=extractTagAttribute(body,'data-navigation');
  let sources=[],defaultColumns=[],columns={},columnURLs={},routes=[],navigation=null,error='';
  try {
    if(!navigationText)return {sources,defaultColumns,columns,columnURLs,routes,navigation,navigationText,error};
    navigation=JSON.parse(navigationText);
    if(!navigation||typeof navigation!=='object'||Array.isArray(navigation))throw new Error('data-navigation is not a JSON object');
    if(!navigation.columns||typeof navigation.columns!=='object'||Array.isArray(navigation.columns))
      throw new Error('Navigation columns is not a JSON object');
    if(typeof navigation.home!=='string'||!navigation.home.startsWith('/')||navigation.home.startsWith('//')||!navigation.home.endsWith('/'))
      throw new Error('Navigation home is not a site path');
    if(typeof navigation.resources!=='string'||(!navigation.resources.endsWith('/')
      &&(navigation.resources!==''||Object.keys(navigation.columns).length>0)))
      throw new Error('Navigation resources directory is missing');
    if(typeof navigation.default!=='string')throw new Error('Navigation default is not a column path');
    const keys=new Map();
    for(const [logicalPath,hash] of Object.entries(navigation.columns)) {
      if(typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))throw new Error('Invalid breadcrumb column hash for '+logicalPath);
      const href=navigation.resources+hash+'.txt';columnURLs[logicalPath]=href;
      if(directory)columns[logicalPath]=readColumn(href,logicalPath,{directory,pagePath,cache});
      keys.set(normalizeLogicalPath(logicalPath),logicalPath);
    }
    const canonical=extractCanonicalHref(text),currentPath=canonical?new URL(canonical).pathname:'/'+(pagePath||'').replace(/index\.html$/,'');
    const hydrate=column=>{
      const logicalPath=column?.column;
      if(typeof logicalPath!=='string'||!Object.hasOwn(columnURLs,logicalPath))
        throw new Error('Missing breadcrumb column URL for '+logicalPath);
      if(column.selected!==undefined&&typeof column.selected!=='string')throw new Error('Invalid selected breadcrumb URL for '+logicalPath);
      const payload=columns[logicalPath],source={logicalPath},href=column.selected||currentPath;
      if(payload)Object.assign(source,{provider:payload.provider,href:payload.href,label:payload.label,sortVariant:payload.sortVariant,defaultSort:payload.defaultSort});
      let selected={href};
      if(payload)for(const row of payload.rows) {
        if(new URL(row.href,'https://output.invalid').pathname===new URL(href,'https://output.invalid').pathname){selected={...row,current:true};break;}
      }
      return {source,selected,payload};
    };
    const hrefFor=key=>navigation.home+key.replace(/^\/+/,''),routeFor=logicalPath=>{
      const raw=keys.get(normalizeLogicalPath(logicalPath)),parts=normalizeLogicalPath(raw||'').split('/').filter(Boolean);
      const path=parts.map((_,index)=>keys.get('/'+parts.slice(0,index+1).join('/')+'/')).filter(Boolean);
      return {root:raw?navigation.home+raw.replace(/^\/+/, '').split('/')[0]+'/':'',columns:path.map((column,index)=>
        hydrate({column,...(index+1<path.length?{selected:hrefFor(path[index+1])}:{})}))};
    };
    if(navigation.default&&!keys.has(normalizeLogicalPath(navigation.default)))throw new Error('Missing breadcrumb column URL for '+navigation.default);
    defaultColumns=navigation.default?routeFor(navigation.default).columns:[];
    const currentCollection=normalizeLogicalPath(extractTagAttribute(body,'data-collection-path'));
    // Sources are inspection data, recovered from terminal rows rather than an inline whitelist.
    for(const [logicalPath,payload] of Object.entries(columns)) {
      let contains=false;
      for(const row of payload.rows) {
        if(row.href&&new URL(row.href,'https://output.invalid').pathname===currentPath){contains=true;break;}
      }
      if(!contains||normalizeLogicalPath(logicalPath)===currentCollection)continue;
      const route=routeFor(logicalPath);routes.push(route);
      sources.push({logicalPath,rootItem:{href:route.root},columns:navigation.default?route.columns.slice(0,-1):[],
        currentColumn:hydrate({column:logicalPath})});
    }
  } catch(cause) {error=cause.message;sources=[];defaultColumns=[];columns={};routes=[];}
  return {sources,defaultColumns,columns,columnURLs,routes,navigation,navigationText,error};
}
