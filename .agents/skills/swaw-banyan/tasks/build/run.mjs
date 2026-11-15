import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {run as hugo} from '../base/hugo/run.mjs';
import {prepareTools} from '../_shared/tools/selection.mjs';
import {toolExecutable} from '../_shared/tools/operations.mjs';
import {execute} from '../_shared/tools/process.mjs';
import {searchArguments} from './search.mjs';
import {readHugoConfig} from '../_shared/hugo.mjs';

function resolvedPath(value) {
  let parent=value;
  while(!fs.existsSync(parent))parent=path.dirname(parent);
  return path.resolve(fs.realpathSync(parent),path.relative(parent,value));
}
function contains(parent,child) {
  const relative=path.relative(parent,child);
  return !relative||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep));
}
export function buildArguments(options,cwd=process.cwd(),config={}) {
  const destination=path.resolve(cwd,options.destination),resolved=resolvedPath(destination),root=fs.realpathSync(cwd);
  const sources=['content','assets','layouts','static','data','i18n','archetypes','config','themes','module','tests','resources','.agents','.git','.codex','.aws'];
  for(const settings of [config,...Object.values(config.languages||{})]) {
    for(const key of ['contentdir','assetdir','layoutdir','staticdir','datadir','i18ndir','archetypedir','themesdir','configdir'])
      for(const value of [settings[key]].flat())if(typeof value==='string'&&value)sources.push(value);
    for(const mount of settings.module?.mounts||[])if(mount.source)sources.push(mount.source);
  }
  if(process.env.HUGO_CONFIGDIR)sources.push(process.env.HUGO_CONFIGDIR);
  if(contains(resolved,root)||sources.some(value=>{
    const source=resolvedPath(path.resolve(root,value));return contains(source,resolved)||contains(resolved,source);
  })||['hugo.toml','hugo.yaml','hugo.yml','hugo.json','config.toml','config.yaml','config.yml','config.json'].some(file=>fs.existsSync(path.join(destination,file))))
    throw new Error('Build destination must not contain site source.');
  const args=['--minify','--noBuildLock','--cleanDestinationDir','--destination',destination];
  if(options.baseURL)args.push('--baseURL',options.baseURL);
  return {destination,args};
}
export async function build(options,{render=hugo,index=execute,prepare=prepareTools,executable=toolExecutable,selection=searchArguments,configuration=readHugoConfig}={}) {
  buildArguments(options);
  const {destination,args}=buildArguments(options,process.cwd(),await configuration());
  const status=await render(args);
  if(status!==0)return status;
  const search=selection(destination);
  if(!search)return 0;
  // The Hugo-to-indexer handoff is build input, not a public site resource.
  fs.rmSync(path.join(destination,'site/search-index.json'),{force:true});
  if(!search.length) {
    fs.mkdirSync(path.join(destination,'pagefind'),{recursive:true});
    fs.writeFileSync(path.join(destination,'pagefind/pagefind-entry.json'),JSON.stringify({languages:{}}));
    return 0;
  }
  await prepare(['pagefind']);
  // Keep a large RSS selection out of Windows' command-line length limit.
  const parent=path.join(os.tmpdir(),'swaw/banyan/build');fs.mkdirSync(parent,{recursive:true});
  const work=fs.mkdtempSync(path.join(parent,'pagefind-'));
  try {
    const config=Object.fromEntries(Array.from({length:search.length/2},(_,i)=>[search[i*2].slice(2).replaceAll('-','_'),search[i*2+1]]));
    const file=path.join(work,'pagefind.json');fs.writeFileSync(file,JSON.stringify(config));
    return await index(executable('pagefind'),[],{cwd:work});
  } finally {fs.rmSync(work,{recursive:true,force:true});}
}
