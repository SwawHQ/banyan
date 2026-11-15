import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {extractExecutable} from '../tar.mjs';

function archive(name='pagefind_extended.exe',type='0') {
  const data=Buffer.alloc(2048),h=data.subarray(0,512);
  h.write(name,0);h.write('00000000003\0',124);h.fill(32,148,156);h.write(type,156);
  const sum=[...h].reduce((a,b)=>a+b,0);h.write(sum.toString(8).padStart(6,'0')+'\0 ',148);
  data.write('exe',512);return data;
}
test('single executable archives reject paths, links, extra members and corruption before writing',()=>{
  const parent=path.join(os.tmpdir(),'swaw/banyan/tar-tests');fs.mkdirSync(parent,{recursive:true});
  const work=fs.mkdtempSync(path.join(parent,'run-')),output=path.join(work,'output'),file=path.join(work,'tool.tar.gz');
  fs.mkdirSync(output);const tool={executable:'pagefind_extended.exe'};
  try {
    const corrupt=archive();corrupt[0]^=1;
    const extra=archive();extra[1024]=1;
    for(const data of [archive('../escape'),archive(tool.executable,'2'),corrupt,extra,archive().subarray(0,1000)]){
      fs.writeFileSync(file,gzipSync(data));assert.throws(()=>extractExecutable(file,output,tool));assert.deepEqual(fs.readdirSync(output),[]);
    }
    fs.writeFileSync(file,gzipSync(archive()));extractExecutable(file,output,tool);
    assert.equal(fs.readFileSync(path.join(output,tool.executable),'utf8'),'exe');
    assert.throws(()=>extractExecutable(file,output,tool));
  } finally {fs.rmSync(work,{recursive:true,force:true});}
});
