import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync,inflateRawSync,crc32} from 'node:zlib';
import {extractionPlan} from '../../tasks/_shared/tools/archive-plan.mjs';
import {plainPath,payloadName,fail} from '../../tasks/_shared/tools/filesystem.mjs';

const limit=512*1024*1024;
const text=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
const field=bytes=>text(bytes).replace(/\0.*$/s,'');
function tarEntries(archive) {
  const data=gunzipSync(fs.readFileSync(archive),{maxOutputLength:limit});
  const entries=[];
  let offset=0,pax={},longName,longLink;
  const octal=bytes=>{const value=field(bytes).trim();if(!/^[0-7]+$/.test(value))fail('invalid_tar_number');return parseInt(value,8);};
  while(offset+512<=data.length) {
    const header=data.subarray(offset,offset+512);
    if(header.every(byte=>byte===0)) {
      if(offset+1024>data.length||data.subarray(offset).some(byte=>byte!==0)||Object.keys(pax).length||longName||longLink)fail('invalid_tar_end');
      return entries;
    }
    const sum=[...header].reduce((n,b,i)=>n+(i>=148&&i<156?32:b),0);
    if(sum!==octal(header.subarray(148,156)))fail('invalid_tar_checksum');
    const size=octal(header.subarray(124,136)),mode=octal(header.subarray(100,108));
    const type=field(header.subarray(156,157)),prefix=field(header.subarray(345,500));
    const bytes=data.subarray(offset+512,offset+512+size);
    offset+=512+Math.ceil(size/512)*512;
    if(size>256*1024*1024||offset>data.length)fail('tar_entry_size_mismatch');
    if(['x','L','K'].includes(type)) {
      if(size>65536)fail('tar_metadata_too_large');
      if(type==='L')longName=field(bytes).replace(/\n$/,'');
      else if(type==='K')longLink=field(bytes).replace(/\n$/,'');
      else {
        let cursor=0;
        while(cursor<bytes.length) {
          const space=bytes.indexOf(32,cursor),lengthText=text(bytes.subarray(cursor,space));
          if(space<cursor||!/^\d+$/.test(lengthText))fail('invalid_tar_pax');
          const length=Number(lengthText),end=cursor+length;
          if(!Number.isSafeInteger(length)||end>bytes.length||end<=space+2||bytes[end-1]!==10)fail('invalid_tar_pax');
          const record=text(bytes.subarray(space+1,end-1)),equal=record.indexOf('=');
          if(equal<1)fail('invalid_tar_pax');
          const key=record.slice(0,equal);
          if(!['path','linkpath','size','mtime','atime','ctime','uid','gid','uname','gname','comment','charset'].includes(key)||Object.hasOwn(pax,key))fail('unsupported_tar_pax');
          pax[key]=record.slice(equal+1);cursor=end;
        }
      }
      continue;
    }
    if(!['','0','5','2'].includes(type))fail('unsupported_tar_entry_type');
    if(pax.size!==undefined&&pax.size!==String(size))fail('tar_entry_size_mismatch');
    let name=pax.path??longName??((prefix?prefix+'/':'')+field(header.subarray(0,100)));
    const link=pax.linkpath??longLink??field(header.subarray(157,257));
    if(type==='5'&&!name.endsWith('/'))name+='/';
    if((type==='5'||type==='2')&&size!==0)fail('invalid_tar_entry_size');
    entries.push({name,length:size,attributes:((type==='5'?0x4000:0x8000)|mode)<<16,flags:0,bytes,link:type==='2'?link:null});
    if(entries.length>25000)fail('too_many_payload_files');
    pax={};longName=longLink=undefined;
  }
  fail('invalid_tar_end');
}
function zipEntries(archive) {
  const data=fs.readFileSync(archive);
  let end=-1;
  for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--)if(data.readUInt32LE(i)===0x06054b50&&i+22+data.readUInt16LE(i+20)===data.length){end=i;break;}
  if(end<0||data.readUInt32LE(end+4)!==0||data.readUInt16LE(end+8)!==data.readUInt16LE(end+10))fail('unsupported_zip_directory');
  const count=data.readUInt16LE(end+10),directorySize=data.readUInt32LE(end+12),directory=data.readUInt32LE(end+16);
  if(count>25000||directory+directorySize!==end)fail('invalid_zip_directory');
  let cursor=directory;
  const entries=[],ranges=[];
  for(let index=0;index<count;index++) {
    if(cursor+46>end||data.readUInt32LE(cursor)!==0x02014b50)fail('invalid_zip_directory');
    const flags=data.readUInt16LE(cursor+8),method=data.readUInt16LE(cursor+10),crc=data.readUInt32LE(cursor+16);
    const compressed=data.readUInt32LE(cursor+20),length=data.readUInt32LE(cursor+24),nameLength=data.readUInt16LE(cursor+28);
    const next=cursor+46+nameLength+data.readUInt16LE(cursor+30)+data.readUInt16LE(cursor+32);
    const local=data.readUInt32LE(cursor+42),attributes=data.readUInt32LE(cursor+38);
    if(next>end||data.readUInt16LE(cursor+34)!==0||local+30>directory||data.readUInt32LE(local)!==0x04034b50||!['0','8'].includes(String(method))||(flags&~0x808))fail('unsupported_zip_entry');
    const name=text(data.subarray(cursor+46,cursor+46+nameLength));
    const start=local+30+data.readUInt16LE(local+26)+data.readUInt16LE(local+28);
    if(data.readUInt16LE(local+6)!==flags||data.readUInt16LE(local+8)!==method||text(data.subarray(local+30,local+30+data.readUInt16LE(local+26)))!==name||start+compressed>directory)fail('zip_header_mismatch');
    if(!(flags&8)&&(data.readUInt32LE(local+14)!==crc||data.readUInt32LE(local+18)!==compressed||data.readUInt32LE(local+22)!==length))fail('zip_header_mismatch');
    ranges.push([local,start+compressed]);
    entries.push({name,length,attributes,flags,read:()=>{
      const bytes=method===0?data.subarray(start,start+compressed):inflateRawSync(data.subarray(start,start+compressed),{maxOutputLength:Math.max(1,Math.min(length,256*1024*1024))});
      if(bytes.length!==length||crc32(bytes)!==crc)fail('zip_entry_integrity_mismatch');
      return bytes;
    }});
    cursor=next;
  }
  if(cursor!==end)fail('invalid_zip_directory');
  ranges.sort((a,b)=>a[0]-b[0]);
  if(ranges.some((r,i)=>i&&r[0]<ranges[i-1][1]))fail('overlapping_zip_entries');
  return entries;
}
export function extract(archive,destination,tool) {
  plainPath(destination);
  if(typeof tool.archiveRoot!=='string'||tool.archiveRoot&&(!payloadName(tool.archiveRoot)||tool.archiveRoot.includes('/')))fail('invalid_archive_root');
  let entries=tool.archiveFormat==='zip'?zipEntries(archive):tarEntries(archive);
  if(tool.name==='git') {
    entries=entries.filter(entry=>!(entry.name==='./'&&(entry.attributes>>>16&0xf000)===0x4000));
    for(const entry of entries)entry.name=entry.name.replace(/^\.\//,'');
    extractionPlan(entries,destination,tool);
    for(const entry of entries)if(entry.link!==null&&entry.link!==undefined) {
      const command=entry.name.match(/^libexec\/git-core\/git-([a-z0-9-]+)$/)?.[1];
      const target=entries.find(item=>item.name==='libexec/git-core/'+entry.link);
      if(!command||!['git','git-remote-http'].includes(entry.link)||!target?.bytes||target.link!==null||target.name.endsWith('/'))fail('unsupported_archive_link');
      // Replace Git's fixed executable aliases with regular files for receipt verification.
      entry.bytes=entry.link==='git'?Buffer.from('#!/bin/sh\nexec "$(dirname -- "$0")/git" '+command+' "$@"\n'):target.bytes;
      entry.length=entry.bytes.length;entry.attributes=0x81ed0000;entry.link=null;
    }
  }
  for(const entry of entries)if(entry.link!==null&&entry.link!==undefined) {
    const name=entry.name.slice(tool.archiveRoot?tool.archiveRoot.length+1:0);
    const script={'bin/npm':'lib/node_modules/npm/bin/npm-cli.js','bin/npx':'lib/node_modules/npm/bin/npx-cli.js','bin/corepack':'lib/node_modules/corepack/dist/corepack.js'}[name];
    if(tool.name!=='node'||!script||entry.link!=='../'+script)fail('unsupported_archive_link');
    // Keep managed payloads link-free, including Node's package-manager entry points.
    entry.bytes=Buffer.from('#!/bin/sh\nroot=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)\nexec "$root/bin/node" "$root/'+script+'" "$@"\n');
    entry.length=entry.bytes.length;entry.attributes=0x81ed0000;
  }
  const plan=extractionPlan(entries,destination,tool);
  for(const {index,target,directory} of plan) {
    if(directory){fs.mkdirSync(target,{recursive:true});continue;}
    const entry=entries[index],bytes=entry.bytes??entry.read();
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,bytes,{flag:'wx',mode:(entry.attributes>>>16)&0o111?0o755:0o644});
  }
}
