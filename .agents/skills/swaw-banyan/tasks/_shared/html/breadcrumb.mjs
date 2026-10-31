import fs from 'node:fs';
import path from 'node:path';
import {insideOutput,localReference} from '../output.mjs';
import {extractCanonicalHref,extractStartTags,extractTagAttribute,isRedirectPage} from './markup.mjs';

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
    try {cache.set(file,JSON.parse(fs.readFileSync(real,'utf8')));} catch(cause) {
      throw new Error('Invalid breadcrumb column JSON '+href+': '+cause.message);
    }
  }
  const payload=cache.get(file);
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.v!==1||payload.p!=='collection'
    ||payload.lp!==logicalPath||typeof payload.label!=='string'||typeof payload.href!=='string'
    ||!Array.isArray(payload.f)||!payload.f.length||!payload.f.every(field=>typeof field==='string')
    ||!Array.isArray(payload.rv)||payload.rv.length%payload.f.length!==0)
    throw new Error('Invalid breadcrumb column payload for '+logicalPath+': '+href);
  return payload;
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
    const normalize=value=>{
      try {value=decodeURIComponent(value);} catch {}
      const parts=value.split('/').filter(Boolean);return parts.length?'/'+parts.join('/')+'/':'';
    };
    const keys=new Map();
    for(const [logicalPath,hash] of Object.entries(navigation.columns)) {
      if(typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))throw new Error('Invalid breadcrumb column hash for '+logicalPath);
      const href=navigation.resources+hash+'.json';columnURLs[logicalPath]=href;
      if(directory)columns[logicalPath]=readColumn(href,logicalPath,{directory,pagePath,cache});
      keys.set(normalize(logicalPath),logicalPath);
    }
    const canonical=extractCanonicalHref(text),currentPath=canonical?new URL(canonical).pathname:'/'+(pagePath||'').replace(/index\.html$/,'');
    const hydrate=column=>{
      const logicalPath=column?.column;
      if(typeof logicalPath!=='string'||!Object.hasOwn(columnURLs,logicalPath))
        throw new Error('Missing breadcrumb column URL for '+logicalPath);
      if(column.selected!==undefined&&typeof column.selected!=='string')throw new Error('Invalid selected breadcrumb URL for '+logicalPath);
      const payload=columns[logicalPath],source={logicalPath},href=column.selected||currentPath;
      if(payload)Object.assign(source,{provider:payload.p,href:payload.href,label:payload.label,sortVariant:payload.sv,defaultSort:payload.ds});
      let selected={href};
      if(payload)for(let index=0;index<payload.rv.length;index+=payload.f.length) {
        const row={...payload.c,...Object.fromEntries(payload.f.map((field,offset)=>[field,payload.rv[index+offset]]))};
        if(row.href===href){selected={...row,current:true};break;}
      }
      return {source,selected,payload};
    };
    const hrefFor=key=>navigation.home+key.replace(/^\/+/,''),routeFor=logicalPath=>{
      const raw=keys.get(normalize(logicalPath)),parts=normalize(raw||'').split('/').filter(Boolean);
      const path=parts.map((_,index)=>keys.get('/'+parts.slice(0,index+1).join('/')+'/')).filter(Boolean);
      return {root:raw?navigation.home+raw.replace(/^\/+/, '').split('/')[0]+'/':'',columns:path.map((column,index)=>
        hydrate({column,...(index+1<path.length?{selected:hrefFor(path[index+1])}:{})}))};
    };
    if(navigation.default&&!keys.has(normalize(navigation.default)))throw new Error('Missing breadcrumb column URL for '+navigation.default);
    defaultColumns=navigation.default?routeFor(navigation.default).columns:[];
    const currentCollection=normalize(extractTagAttribute(body,'data-collection-path'));
    // Sources are inspection data, recovered from terminal rows rather than an inline whitelist.
    for(const [logicalPath,payload] of Object.entries(columns)) {
      let contains=false;
      for(let index=0;index<payload.rv.length;index+=payload.f.length) {
        const row={...payload.c,...Object.fromEntries(payload.f.map((field,offset)=>[field,payload.rv[index+offset]]))};
        if(row.href&&new URL(row.href,'https://output.invalid').pathname===currentPath){contains=true;break;}
      }
      if(!contains||normalize(logicalPath)===currentCollection)continue;
      const route=routeFor(logicalPath);routes.push(route);
      sources.push({logicalPath,rootItem:{href:route.root},columns:navigation.default?route.columns.slice(0,-1):[],
        currentColumn:hydrate({column:logicalPath})});
    }
  } catch(cause) {error=cause.message;sources=[];defaultColumns=[];columns={};routes=[];}
  return {sources,defaultColumns,columns,columnURLs,routes,navigation,navigationText,error};
}
