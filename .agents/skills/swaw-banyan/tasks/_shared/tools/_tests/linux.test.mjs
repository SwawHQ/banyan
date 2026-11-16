import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {prepareTool,prepareRuntime,inspectBinding} from '../selection.mjs';
import {writeBindings} from '../bindings.mjs';

const linux = {skip:!['linux','darwin'].includes(process.platform)};
const platform=process.platform==='darwin'?'mac':'linux';
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/linux-tools');
function workspace() {fs.mkdirSync(parent,{recursive:true});return fs.mkdtempSync(path.join(parent,'run-'));}
function git(directory,version) {
  fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'git'),`#!/bin/sh\nprintf 'git version ${version}\\n'\n`,{mode:0o755});
}
const noDownload=async()=>{throw new Error('unexpected_download');};

test('POSIX reuses compatible PATH Git, then keeps the selected binding',linux,async()=>{
  const work=workspace(),root=path.join(work,'tools'),first=path.join(work,'first'),second=path.join(work,'second');
  try {
    git(first,'2.43.0');git(second,'2.44.0');
    const selected=await prepareTool('git',[],{root,env:{PATH:first},receive:noDownload});
    assert.equal(selected.source,'path');assert.equal(selected.path,path.join(first,'git'));
    assert.equal((await prepareTool('git',[],{root,env:{PATH:second},receive:noDownload})).path,selected.path);
    assert.equal((await inspectBinding('git',{root})).version,'2.43.0');
  } finally {fs.rmSync(work,{recursive:true,force:true});}
});
test('POSIX rejects old or non-executable PATH tools and reaches download',linux,async()=>{
  const work=workspace(),root=path.join(work,'tools'),bin=path.join(work,'bin');
  try {
    git(bin,'2.20.0');
    await assert.rejects(prepareTool('git',[],{root,env:{PATH:bin},receive:noDownload}),/unexpected_download/);
    git(bin,'2.43.0');fs.chmodSync(path.join(bin,'git'),0o644);
    await assert.rejects(prepareTool('git',[],{root,env:{PATH:bin},receive:noDownload}),/unexpected_download/);
  } finally {fs.rmSync(work,{recursive:true,force:true});}
});
test('POSIX Node PATH binding locates npm and writes an argument-safe launcher',linux,async()=>{
  const work=workspace(),root=path.join(work,"tools ' space");
  try {
    const runtime=await prepareRuntime([],{root,env:{...process.env,PATH:path.dirname(process.execPath)},receive:noDownload});
    assert.equal(runtime.source,'path');assert.ok(runtime.npmDirectory);
    await inspectBinding('node',{root});
    const script=path.join(work,'args.mjs');fs.writeFileSync(script,'console.log(JSON.stringify(process.argv.slice(2)))');
    const args=['a b',"quote'",'$(touch nope)','; true'];
    const result=spawnSync('/bin/sh',[path.join(root,'cli'),script,...args],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),args);
    const boot=path.join(root,'bootstrap-node.txt'),original=fs.readFileSync(boot);
    fs.writeFileSync(boot,'changed');await assert.rejects(inspectBinding('node',{root}),/runtime_bootstrap_changed/);fs.writeFileSync(boot,original);
    fs.writeFileSync(path.join(root,'cli'),'unknown launcher');
    assert.throws(()=>writeBindings({schema:'swaw-banyan.bindings/v1',runtime:'node',tools:{node:runtime}},root),/unknown_runtime_launcher/);
  } finally {fs.rmSync(work,{recursive:true,force:true});}
});
test('POSIX cold help matches Node help without PATH tools',linux,()=>{
  const skill=fileURLToPath(new URL('../../../../',import.meta.url));
  for (const args of [['help/en'],['help/zh','1'],['help/en','base','2'],['build','--help']]) {
    const cold=spawnSync('/bin/sh',[path.join(skill,'platform/'+platform+'/bootstrap.sh'),...args],{env:{...process.env,PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8'},encoding:'utf8'});
    const warm=spawnSync(process.execPath,[path.join(skill,'tasks/_cli/main.mjs'),...args],{env:{...process.env,LANG:'en_US.UTF-8'},encoding:'utf8'});
    assert.equal(cold.status,0,cold.stderr);assert.equal(warm.status,0,warm.stderr);assert.equal(cold.stdout,warm.stdout);
  }
});
test('POSIX managed launcher resolves its own directory with spaces and quotes',linux,()=>{
  const work=workspace(),root=path.join(work,"tools ' space"),bin=path.join(root,'node/bin');
  try {
    fs.mkdirSync(bin,{recursive:true});fs.writeFileSync(path.join(bin,'node'),'#!/bin/sh\nprintf "%s\\n" "$@"\n',{mode:0o755});
    writeBindings({schema:'swaw-banyan.bindings/v1',runtime:'node',tools:{node:{source:'managed',path:'node/bin/node',version:'24.20.0'}}},root);
    const result=spawnSync('/bin/sh',[path.join(root,'cli'),'a b',"c'd"],{cwd:'/',encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,"a b\nc'd\n");
  } finally {fs.rmSync(work,{recursive:true,force:true});}
});
