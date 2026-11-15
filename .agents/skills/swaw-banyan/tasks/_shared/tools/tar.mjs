import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {plainPath,payloadName} from './filesystem.mjs';

// Pagefind ships one regular executable; reject other tar features before writing.
export function extractExecutable(archive, destination, tool) {
  if(!payloadName(tool.executable)||tool.executable.includes('/'))throw new Error('unsupported_executable_archive');
  plainPath(destination);
  const data=gunzipSync(fs.readFileSync(archive),{maxOutputLength:64*1024*1024});
  const header=data.subarray(0,512);
  const text=(start,end)=>header.subarray(start,end).toString('utf8').replace(/\0.*$/s,'').trim();
  const sizeText=text(124,136),sumText=text(148,156);
  const size=parseInt(sizeText,8),checksum=parseInt(sumText,8);
  const actual=[...header].reduce((sum,value,index)=>sum+(index>=148&&index<156?32:value),0);
  const end=512+Math.ceil(size/512)*512;
  if(header.length!==512||text(0,100)!==tool.executable||text(345,500)||text(157,257)||
    !['','0'].includes(text(156,157))||!/^0[0-7]*$/.test(sizeText)||!/^0?[0-7]+$/.test(sumText)||
    size<=0||end+1024>data.length||checksum!==actual||data.subarray(end).some(byte=>byte!==0))
    throw new Error('unsupported_executable_archive');
  fs.writeFileSync(path.join(destination,tool.executable),data.subarray(512,512+size),{flag:'wx'});
}
