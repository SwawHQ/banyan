import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {extract,canProbe} from '../../../../platform/mac/runtime.mjs';

test('Mac JS discovery rejects Node from the other architecture',t=>{
  const run=t.mock.method(childProcess,'spawnSync',()=>({status:0,stdout:process.arch+'\n'}));
  assert.equal(canProbe('node','fixture-node'),true);
  run.mock.mockImplementation(()=>({status:0,stdout:(process.arch==='x64'?'arm64':'x64')+'\n'}));
  assert.equal(canProbe('node','fixture-node'),false);
  run.mock.mockImplementation(()=>({status:1,stdout:''}));
  assert.equal(canProbe('node','fixture-node'),false);
});

test('Mac ARM64 selects its own manifest and accepts Universal Hugo packages',()=>{
  const manifest=new URL('../manifest.mjs',import.meta.url).href;
  const result=childProcess.spawnSync(process.execPath,['--input-type=module','-e',`
    Object.defineProperty(process,'platform',{value:'darwin'});
    Object.defineProperty(process,'arch',{value:'arm64'});
    const {definition,platform}=await import(${JSON.stringify(manifest)});
    const tools=['node','git','go','hugo','bun','gh','pagefind'].map(name=>definition(name));
    console.log(JSON.stringify({platform,tools}));
  `],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const {platform,tools}=JSON.parse(result.stdout);
  assert.equal(platform,'mac-arm64');
  for(const tool of tools)assert.match(tool.url,/arm64|aarch64|darwin-universal/);
  assert.equal(tools.find(tool=>tool.name==='hugo').archiveFormat,'pkg');
  assert.ok(tools.find(tool=>tool.name==='go').requiredFiles.includes('pkg/tool/darwin_arm64/compile'));
});

test('Mac shell selects x64 or ARM64 and rejects a mismatched Node',{skip:process.platform==='win32'},()=>{
  const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/mac-architecture');fs.mkdirSync(parent,{recursive:true});
  const root=fs.mkdtempSync(path.join(parent,'run-'));
  const system=fileURLToPath(new URL('../../../../platform/mac/system.sh',import.meta.url));
  try {
    fs.writeFileSync(path.join(root,'uname'),'#!/bin/sh\ncase "$1" in -s) echo Darwin;; -m) echo "$TEST_MACHINE";; esac\n',{mode:0o755});
    const node=path.join(root,'node');fs.writeFileSync(node,'#!/bin/sh\nprintf "v24.20.0 %s\\n" "$TEST_NODE_ARCH"\n',{mode:0o755});
    const run=(machine,arch)=>childProcess.spawnSync('/bin/sh',['-c','fail() { echo "$*" >&2; exit 1; }; . "$1"; node_version "$2"','test',system,node],{
      env:{...process.env,PATH:root+':/usr/bin:/bin',TEST_MACHINE:machine,TEST_NODE_ARCH:arch},encoding:'utf8',timeout:10000});
    for(const [machine,arch] of [['x86_64','x64'],['arm64','arm64']]) {
      const result=run(machine,arch);assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'v24.20.0\n');
    }
    assert.equal(run('arm64','x64').status,1);
    assert.equal(run('x86_64','arm64').status,1);
    assert.match(run('unknown','arm64').stderr,/supported_mac_architectures/);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('Mac Git shim is not executed when developer tools are missing',{skip:process.platform!=='darwin'},t=>{
  const run=t.mock.method(childProcess,'spawnSync',(file,args)=>{
    assert.equal(file,'/usr/bin/xcode-select');assert.deepEqual(args,['-p']);return {status:1};
  });
  assert.equal(canProbe('git','/usr/bin/git'),false);
  run.mock.mockImplementation(()=>({status:0}));assert.equal(canProbe('git','/usr/bin/git'),true);
});

test('Mac Hugo extraction only copies the expected payload and never invokes installer',t=>{
  const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/mac-package');fs.mkdirSync(parent,{recursive:true});
  const root=fs.mkdtempSync(path.join(parent,'run-')),destination=path.join(root,'payload');fs.mkdirSync(destination);
  let extra=false;
  t.mock.method(childProcess,'spawnSync',(file,args)=>{
    assert.equal(file,'/usr/sbin/pkgutil');assert.equal(args[0],'--expand-full');
    const payload=path.join(args[2],'Payload');fs.mkdirSync(payload,{recursive:true});
    fs.writeFileSync(path.join(payload,'hugo'),'fixture');
    if(extra)fs.writeFileSync(path.join(payload,'extra'),'unexpected');
    return {status:0};
  });
  try {
    extract('verified.pkg',destination,{name:'hugo',archiveFormat:'pkg'});
    assert.equal(fs.readFileSync(path.join(destination,'hugo'),'utf8'),'fixture');
    fs.rmSync(path.join(root,'expanded'),{recursive:true});fs.unlinkSync(path.join(destination,'hugo'));extra=true;
    assert.throws(()=>extract('verified.pkg',destination,{name:'hugo',archiveFormat:'pkg'}),/unexpected_hugo_payload/);
    assert.deepEqual(fs.readdirSync(destination),[]);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
