import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sha256} from '../filesystem.mjs';

const platform=process.platform==='darwin'?'mac':'linux';
test('POSIX cold bootstrap preserves binding, managed and PATH order and checks managed integrity',{skip:!['linux','darwin'].includes(process.platform)},()=>{
  const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/linux-bootstrap');fs.mkdirSync(parent,{recursive:true});
  const root=fs.mkdtempSync(path.join(parent,"run ' space-")),skill=fileURLToPath(new URL('../../../../',import.meta.url));
  const write=(name,text)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);return file;};
  const binary=(name,label,version='24.20.0')=>{const file=write(name,`#!/bin/sh\nif [ "$1" = --version ]; then printf 'v${version}\\n'; elif [ "$1" = -p ]; then printf 'v${version} ${process.arch}\\n'; else printf '${label}\\n'; fi\n`);fs.chmodSync(file,0o755);return file;};
  try {
    for(const file of ['bootstrap.sh','system.sh','node-'+process.arch+'.txt'])write('platform/'+platform+'/'+file,fs.readFileSync(path.join(skill,'platform',platform,file)));
    write('platform/posix/bootstrap.sh',fs.readFileSync(path.join(skill,'platform/posix/bootstrap.sh')));
    write('tasks/base/node/check/entry.mjs','');
    const bound=binary('external/bound-node','bound'),managed=binary('.tools/node/bin/node','managed'),fromPath=binary('bin/node','path');
    const receipt=write('.tools/node/install.json','{"schema":"fixture"}');
    write('.tools/node-receipt.txt','swaw-banyan.bootstrap-node/v1\n24.20.0\n'+sha256(managed)+'\n'+sha256(receipt)+'\n');
    const binding=write('.tools/bootstrap-node.txt','swaw-banyan.bootstrap-binding/v1\npath\n'+bound+'\n');
    const run=()=>spawnSync('/bin/sh',[path.join(root,'platform/'+platform+'/bootstrap.sh'),'base/node/check'],{env:{...process.env,PATH:path.join(root,'bin')+':/usr/bin:/bin'},encoding:'utf8',timeout:15000});
    assert.equal(run().stdout,'bound\n');
    fs.unlinkSync(binding);assert.equal(run().stdout,'managed\n');
    fs.appendFileSync(receipt,'changed');assert.equal(run().stdout,'path\n');
    fs.writeFileSync(receipt,'{"schema":"fixture"}');
    fs.appendFileSync(managed,'# changed');assert.equal(run().stdout,'path\n');
    fs.unlinkSync(managed);fs.symlinkSync(bound,managed);assert.equal(run().stdout,'path\n');
    binary('bin/node','old','20.0.0');
    // Hide any system Node; only the bootstrap's system utilities remain on PATH.
    for(const name of ['awk','dirname','uname','readlink',...(platform==='mac'?['shasum','sleep']:['timeout','sha256sum'])])fs.symlinkSync(fs.existsSync('/usr/bin/'+name)?'/usr/bin/'+name:'/bin/'+name,path.join(root,'bin',name));
    const missing=spawnSync('/bin/sh',[path.join(root,'platform/'+platform+'/bootstrap.sh'),'base/node/check'],{env:{...process.env,PATH:path.join(root,'bin')},encoding:'utf8'});
    assert.equal(missing.status,1);assert.match(missing.stderr,/runtime_not_ready/);assert.doesNotMatch(missing.stderr,/Banyan bootstrap/);
    fs.writeFileSync(fromPath,'#!/bin/sh\nexec /bin/sleep 30\n');
    const started=Date.now(),hung=run();
    assert.equal(hung.status,1,hung.stderr);assert.ok(Date.now()-started<10000,'version probe must time out');
    binary('bin/node','old','20.0.0');
    assert.ok(fs.existsSync(fromPath));
    write('tasks/base/node/ensure/entry.mjs','');
    for(const name of ['mkdir','mktemp','rm','rmdir','tar'])fs.symlinkSync(fs.existsSync('/usr/bin/'+name)?'/usr/bin/'+name:'/bin/'+name,path.join(root,'bin',name));
    const curl=write('bin/curl','#!/bin/sh\nwhile [ "$#" -gt 0 ]; do if [ "$1" = --output ]; then shift; printf corrupt > "$1"; exit 0; fi; shift; done\nexit 1\n');fs.chmodSync(curl,0o755);
    const before=fs.readFileSync(receipt,'utf8');
    const rejected=spawnSync('/bin/sh',[path.join(root,'platform/'+platform+'/bootstrap.sh'),'base/node/ensure'],{env:{...process.env,PATH:path.join(root,'bin')},encoding:'utf8'});
    assert.equal(rejected.status,1);assert.match(rejected.stderr,/download_hash_mismatch/);
    assert.equal(fs.readFileSync(receipt,'utf8'),before);assert.deepEqual(fs.readdirSync(path.join(root,'.tools/.cache')),[]);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
