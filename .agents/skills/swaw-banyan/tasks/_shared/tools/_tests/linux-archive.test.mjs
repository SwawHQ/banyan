import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {extract} from '../../../../platform/posix/archive.mjs';
import {bootstrapData} from '../../../../platform/posix/bootstrap-data.mjs';
import {zip} from './fixtures/zip.mjs';

function workspace(run) {
  const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/linux-archive');fs.mkdirSync(parent,{recursive:true});
  const root=fs.mkdtempSync(path.join(parent,'run-')),output=path.join(root,'out');fs.mkdirSync(output);
  try{return run(root,output);}finally{fs.rmSync(root,{recursive:true,force:true});}
}
function tar(entries) {
  return Buffer.concat([...entries.flatMap(({name,type='0',data=Buffer.from('payload'),link='',mode=0o755})=>{
    if(['2','5'].includes(type))data=Buffer.alloc(0);
    const header=Buffer.alloc(512);header.write(name,0);header.write(mode.toString(8).padStart(7,'0')+'\0',100);
    header.write(data.length.toString(8).padStart(11,'0')+'\0',124);header.fill(32,148,156);header.write(type,156);header.write(link,157);
    header.write([...header].reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148);
    return [header,data,Buffer.alloc((512-data.length%512)%512)];
  }),Buffer.alloc(1024)]);
}
const tarTool={name:'hugo',archiveFormat:'tar.gz',archiveRoot:''};
test('POSIX bootstrap release data matches its platform manifest',()=>{
  for(const [platform,architecture] of [['linux','x64'],['mac','x64'],['mac','arm64']])assert.equal(fs.readFileSync(new URL('../../../../platform/'+platform+'/node-'+architecture+'.txt',import.meta.url),'utf8'),bootstrapData(platform,architecture));
  assert.throws(()=>bootstrapData('mac','unknown'),/unsupported_bootstrap_platform/);
});

test('POSIX portable Git aliases stay within the verified payload',()=>workspace((root,out)=>{
  const file=path.join(root,'git.tar.gz'),tool={name:'git',archiveFormat:'tar.gz',archiveRoot:''};
  const entries=[{name:'./',type:'5'},{name:'./libexec/git-core/git',data:Buffer.from('binary')},
    {name:'./libexec/git-core/git-fetch',type:'2',link:'git'},
    {name:'./libexec/git-core/git-remote-http',data:Buffer.from('https helper')},
    {name:'./libexec/git-core/git-remote-https',type:'2',link:'git-remote-http'}];
  fs.writeFileSync(file,gzipSync(tar(entries)));extract(file,out,tool);
  assert.match(fs.readFileSync(path.join(out,'libexec/git-core/git-fetch'),'utf8'),/git" fetch "\$@"/);
  assert.equal(fs.readFileSync(path.join(out,'libexec/git-core/git-remote-https'),'utf8'),'https helper');
  for(const bad of ['../../outside','/bin/git','git-fetch']) {
    const destination=path.join(root,'bad-'+bad.replaceAll(/[^a-z]/g,''));fs.mkdirSync(destination);
    fs.writeFileSync(file,gzipSync(tar([...entries,{name:'./libexec/git-core/git-clone',type:'2',link:bad}])));
    assert.throws(()=>extract(file,destination,tool),/unsupported_archive_link/);assert.deepEqual(fs.readdirSync(destination),[]);
  }
}));
test('POSIX tar rejects traversal, collisions, links and corruption before writes',()=>workspace((root,out)=>{
  const file=path.join(root,'tool.tar.gz');
  const cases=[tar([{name:'../escape'}]),tar([{name:'/escape'}]),tar([{name:'good'},{name:'good'}]),tar([{name:'good'},{name:'good/child'}]),
    tar([{name:'link',type:'2',link:'/tmp/escape'}]),tar([{name:'hard',type:'1',link:'good'}]),tar([{name:'pipe',type:'6'}])];
  const badChecksum=tar([{name:'good'}]);badChecksum[0]^=1;cases.push(badChecksum);
  cases.push(tar([{name:'good'}]).subarray(0,700));
  for(const bytes of cases){fs.writeFileSync(file,gzipSync(bytes));assert.throws(()=>extract(file,out,tarTool));assert.deepEqual(fs.readdirSync(out),[]);}
}));
test('POSIX tar keeps modes and converts only the fixed Node package-manager links',()=>workspace((root,out)=>{
  const file=path.join(root,'tool.tar.gz'),tool={...tarTool,name:'node',archiveRoot:'node'};
  fs.writeFileSync(file,gzipSync(tar([{name:'node/',type:'5'},{name:'node/bin/node'},{name:'node/LICENSE',mode:0o644},
    {name:'node/bin/npm',type:'2',link:'../lib/node_modules/npm/bin/npm-cli.js'}])));
  extract(file,out,tool);
  assert.match(fs.readFileSync(path.join(out,'bin/npm'),'utf8'),/exec "\$root\/bin\/node"/);
  assert.equal(fs.lstatSync(path.join(out,'bin/npm')).isSymbolicLink(),false);
  if(process.platform!=='win32'){assert.equal(fs.statSync(path.join(out,'bin/node')).mode&0o777,0o755&~process.umask());assert.equal(fs.statSync(path.join(out,'LICENSE')).mode&0o777,0o644&~process.umask());}
  assert.throws(()=>extract(file,out,tool),/EEXIST/);
}));
test('POSIX tar validates GNU long names and PAX paths using the same extraction plan',()=>workspace((root,out)=>{
  const file=path.join(root,'tool.tar.gz'),name='a'.repeat(110);
  fs.writeFileSync(file,gzipSync(tar([{name:'././@LongLink',type:'L',data:Buffer.from(name+'\0')},{name:'short'}])));
  extract(file,out,tarTool);assert.equal(fs.readFileSync(path.join(out,name),'utf8'),'payload');
  const record='path=../escape\n';let length=record.length+2;while(String(length).length+1+record.length!==length)length=String(length).length+1+record.length;
  fs.writeFileSync(file,gzipSync(tar([{name:'PaxHeader',type:'x',data:Buffer.from(length+' '+record)},{name:'short'}])));
  assert.throws(()=>extract(file,out,tarTool),/unsafe_zip_entry/);assert.equal(fs.existsSync(path.join(root,'escape')),false);
}));
test('POSIX ZIP checks paths, types, CRC, sizes and root before extraction',()=>workspace((root,out)=>{
  const file=path.join(root,'tool.zip'),tool={name:'bun',archiveFormat:'zip',archiveRoot:''};
  for(const entries of [[{name:'../escape'}],[{name:'good'},{name:'good/child'}],[{name:'link',mode:0xa000}],
    [{name:'good'},{name:'good'}],[{name:'dir/',mode:0x8000}],[{name:'secret',flags:0x801}],
    [{name:'size',size:268435457}],[{name:'size',bytes:Buffer.from('payload'),size:1}]]) {
    fs.writeFileSync(file,zip(entries));assert.throws(()=>extract(file,out,tool));assert.deepEqual(fs.readdirSync(out),[]);
  }
  const corrupt=zip([{name:'file',bytes:Buffer.from('payload')}]);corrupt[34]^=1;
  fs.writeFileSync(file,corrupt);assert.throws(()=>extract(file,out,tool));assert.deepEqual(fs.readdirSync(out),[]);
  fs.writeFileSync(file,zip([{name:'sdk/bin/树',bytes:Buffer.from('payload'),mode:0x81ed},{name:'sdk/empty'}]));
  assert.throws(()=>extract(file,out,{...tool,archiveRoot:'other'}),/unexpected_archive_root/);
  extract(file,out,{...tool,archiveRoot:'sdk'});assert.equal(fs.readFileSync(path.join(out,'bin/树'),'utf8'),'payload');
}));
