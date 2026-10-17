import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const tasksRoot=fileURLToPath(new URL('../',import.meta.url));
const segment=/^[a-z_][a-z0-9_-]*(?:\.[a-z_][a-z0-9_-]*)*$/;
export const systemLanguage=()=>/^zh(?:-|$)/i.test(Intl.DateTimeFormat().resolvedOptions().locale)?'zh':'en';
const hasEntry=dir=>fs.statSync(path.join(dir,'entry.mjs'),{throwIfNoEntry:false})?.isFile()??false;

function directory(command,root) {
  if (!command.split('/').every(part=>segment.test(part))) throw new Error('unknown_help:'+command);
  let current=fs.realpathSync(root);
  for (const part of command.split('/')) {
    current=path.join(current,part);
    const stat=fs.lstatSync(current,{throwIfNoEntry:false});
    if (!stat?.isDirectory()||stat.isSymbolicLink()) throw new Error('unknown_help:'+command);
  }
  return current;
}

function readDocument(command,root,language) {
  const file=path.join(directory(command,root),'help.json');
  const stat=fs.lstatSync(file,{throwIfNoEntry:false});
  if (!stat?.isFile()||stat.isSymbolicLink()) throw new Error('missing_help:'+command);
  const invalid=(en,zh)=>{throw new Error(language==='zh'?`帮助文件格式错误：${file}\n${zh}`:`Invalid help file: ${file}\n${en}`);};
  const source=fs.readFileSync(file,'utf8');
  let document;
  try { document=JSON.parse(source); }
  catch (error) { invalid('Invalid JSON: '+error.message,'JSON 语法错误：'+error.message); }
  for (const name of ['en','zh']) {
    const item=document?.[name];
    if (!item||typeof item!=='object'||Array.isArray(item)) invalid(`${name} must be an object.`,`${name} 必须是对象。`);
    for (const key of ['summary','usage']) {
      if (typeof item[key]!=='string'||!item[key].trim()||/[\r\n]/.test(item[key])) {
        invalid(`${name}.${key} must be a non-empty single-line string.`,`${name}.${key} 必须是非空的单行字符串。`);
      }
    }
    if (!Array.isArray(item.details)) invalid(`${name}.details must be an array of strings.`,`${name}.details 必须是字符串数组。`);
    for (const [index,line] of item.details.entries()) {
      if (typeof line!=='string'||/[\r\n]/.test(line)) {
        invalid(`${name}.details[${index}] must be a single-line string.`,`${name}.details[${index}] 必须是单行字符串。`);
      }
    }
  }
  return document;
}

export function catalog(root=tasksRoot,language=systemLanguage()) {
  const items=[];
  function visit(dir,command) {
    const executable=hasEntry(dir);
    let active=executable;
    for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
      if (!entry.isDirectory()||entry.isSymbolicLink()||entry.name==='node_modules'||!segment.test(entry.name)) continue;
      if (visit(path.join(dir,entry.name),command?command+'/'+entry.name:entry.name)) active=true;
    }
    if (active&&command) items.push({path:command,executable,document:readDocument(command,root,language)});
    return active;
  }
  visit(fs.realpathSync(root),'');
  return items.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}

function rows(items,language) {
  const names=items.map(item=>item.path+(item.executable?'':'/'));
  const width=Math.max(0,...names.map(name=>name.length));
  return items.map((item,index)=>names[index].padEnd(width)+'  #'+item.document[language].summary).join('\n');
}

export function taskHelp(command,language=systemLanguage(),root=tasksRoot) {
  if (!['en','zh'].includes(language)) throw new Error('unsupported_help_language:'+language);
  command=command.replace(/\/$/,'');
  const document=readDocument(command,root,language)[language];
  const lines=[document.usage+'  #'+document.summary,...(document.details.length?['',...document.details]:[])];
  if (!hasEntry(directory(command,root))) {
    const children=catalog(root,language).filter(item=>item.path.startsWith(command+'/')&&item.path.split('/').length===command.split('/').length+1);
    if (!children.length) throw new Error('unknown_help:'+command);
    lines.push('',rows(children,language));
  }
  return lines.join('\n');
}

export function help(args=[],language=systemLanguage(),root=tasksRoot) {
  if (!['en','zh'].includes(language)) throw new Error('unsupported_help_language:'+language);
  if (args.length>2) throw new Error('invalid_help_arguments');
  let [query,levels]=args;
  const scoped=levels!==undefined;
  if (!scoped&&(query===undefined||['--help','-h'].includes(query))) return taskHelp('help',language,root);
  if (!scoped&&!/^\d+$/.test(query)) return taskHelp(query,language,root);
  if (scoped&&(/^\d+$/.test(query)||['--help','-h'].includes(query))) throw new Error('invalid_help_arguments');
  const value=scoped?levels:query;
  if (!/^\d+$/.test(value)) throw new Error('invalid_help_depth');
  const depth=Number(value);
  if (!Number.isSafeInteger(depth)||depth<1) throw new Error('invalid_help_depth');
  if (scoped) { query=query.replace(/\/$/,''); readDocument(query,root,language); }
  const items=catalog(root,language);
  if (scoped&&!items.some(item=>item.path===query)) throw new Error('unknown_help:'+query);
  const offset=scoped?query.split('/').length:0;
  return rows(items.filter(item=>(!scoped||item.path.startsWith(query+'/'))&&item.path.split('/').length-offset<=depth),language);
}
