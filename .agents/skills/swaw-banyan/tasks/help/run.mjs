import {usageError} from '../_shared/usage.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const tasksRoot=fileURLToPath(new URL('../',import.meta.url));
const segment=/^[a-z_][a-z0-9_-]*(?:\.[a-z_][a-z0-9_-]*)*$/;
export const systemLanguage=()=>/^zh(?:-|$)/i.test(Intl.DateTimeFormat().resolvedOptions().locale)?'zh':'en';
const hasEntry=dir=>fs.statSync(path.join(dir,'entry.mjs'),{throwIfNoEntry:false})?.isFile()??false;

function directory(command,root) {
  if (!command.split('/').every(part=>segment.test(part))) throw usageError('unknown_help:'+command);
  let current=fs.realpathSync(root);
  for (const part of command.split('/')) {
    current=path.join(current,part);
    const stat=fs.lstatSync(current,{throwIfNoEntry:false});
    if (!stat?.isDirectory()||stat.isSymbolicLink()) throw usageError('unknown_help:'+command);
  }
  return current;
}

function readDocument(command,root,language) {
  const dir=directory(command,root),document={};
  for (const name of ['en','zh']) {
    const file=path.join(dir,'help.'+name+'.txt');
    const stat=fs.lstatSync(file,{throwIfNoEntry:false});
    if (!stat?.isFile()||stat.isSymbolicLink()) throw new Error('missing_help:'+command);
    const text=fs.readFileSync(file,'utf8').replace(/\n$/,'');
    const first=text.split('\n',1)[0],index=first.indexOf('  #');
    if (text.includes('\r')||text.startsWith('\uFEFF')||index<1||!first.slice(0,index).trim()||!first.slice(index+3).trim())
      throw new Error((language==='zh'?'帮助文件格式错误：':'Invalid help file: ')+file+'\nExpected: usage  #summary');
    document[name]={usage:first.slice(0,index),summary:first.slice(index+3),text};
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
  const lines=[document.text];
  if (!hasEntry(directory(command,root))) {
    const children=catalog(root,language).filter(item=>item.path.startsWith(command+'/')&&item.path.split('/').length===command.split('/').length+1);
    if (children.length) lines.push('',rows(children,language));
  }
  return lines.join('\n');
}

export function help(args=[],language=systemLanguage(),root=tasksRoot) {
  if (!['en','zh'].includes(language)) throw new Error('unsupported_help_language:'+language);
  if (args.length>2) throw usageError('invalid_help_arguments');
  let [query,levels]=args;
  const scoped=levels!==undefined;
  if (!scoped&&query===undefined) return taskHelp('help',language,root);
  if (!scoped&&!/^\d+$/.test(query)) return taskHelp(query,language,root);
  if (scoped&&(/^\d+$/.test(query)||['--help','-h'].includes(query))) throw usageError('invalid_help_arguments');
  const value=scoped?levels:query;
  if (!/^\d+$/.test(value)) throw usageError('invalid_help_depth');
  const depth=Number(value);
  if (!Number.isSafeInteger(depth)||depth<1) throw usageError('invalid_help_depth');
  if (scoped) { query=query.replace(/\/$/,''); readDocument(query,root,language); }
  const items=catalog(root,language);
  if (scoped&&!items.some(item=>item.path===query)) throw usageError('unknown_help:'+query);
  const offset=scoped?query.split('/').length:0;
  return rows(items.filter(item=>(!scoped||item.path.startsWith(query+'/'))&&item.path.split('/').length-offset<=depth),language);
}
