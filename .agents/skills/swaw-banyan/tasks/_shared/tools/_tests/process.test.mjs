import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {probe} from '../process.mjs';

async function fixture(run) {
  const parent = fs.realpathSync.native(os.tmpdir()),work = fs.mkdtempSync(path.join(parent,'swban-probe-'));
  try {await run(work);}
  finally {
    assert.equal(path.dirname(fs.realpathSync.native(work)),parent);assert.ok(path.basename(work).startsWith('swban-probe-'));
    fs.rmSync(work,{recursive:true,force:true});
  }
}

test('probe runs the child in the requested working directory',()=>fixture(async work=>{
  const result = await probe(process.execPath,['-e','console.log(process.cwd())'],{cwd:work});
  assert.equal(result.ok,true);assert.equal(fs.realpathSync.native(result.text),fs.realpathSync.native(work));
}));

test('probe returns failure when its running child is aborted',()=>fixture(async work=>{
  const ready = path.join(work,'ready'),controller = new AbortController();
  const watcher = fs.watch(work,()=>{if(fs.existsSync(ready))controller.abort();});
  try {
    const result = await probe(process.execPath,['-e',
      "require('node:fs').writeFileSync(process.argv[1],'running');setTimeout(()=>{},1000)",ready],{signal:controller.signal});
    assert.equal(fs.readFileSync(ready,'utf8'),'running');assert.equal(controller.signal.aborted,true);
    assert.deepEqual(result,{ok:false,text:''});
  } finally {watcher.close();}
}));

test('probe reports missing executables and prior cancellation as failures',()=>fixture(async work=>{
  assert.deepEqual(await probe(path.join(work,'missing.exe'),[]),{ok:false,text:''});
  const controller = new AbortController();controller.abort();
  assert.deepEqual(await probe(process.execPath,['-e','process.exit(0)'],{signal:controller.signal}),{ok:false,text:''});
}));

test('Windows probe cancellation and timeout stop both a wrapper and its child',
  {skip:process.platform !== 'win32',timeout:15000},async()=>{
  for (const abort of [true,false]) await fixture(async work=>{
    const ready = path.join(work,'child.pid'),controller = new AbortController();
    const watcher = fs.watch(work,()=>{if(abort && fs.existsSync(ready))controller.abort();});
    try {
      const child = "require('node:fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)";
      const wrapper = "require('node:child_process').spawn(process.execPath,['-e',process.argv[1],process.argv[2]],{stdio:'ignore'});setInterval(()=>{},1000)";
      const result = await probe(process.execPath,['-e',wrapper,child,ready],{cwd:work,signal:controller.signal,timeout:abort?5000:1500});
      assert.deepEqual(result,{ok:false,text:''});assert.equal(controller.signal.aborted,abort);
      const pid = Number(fs.readFileSync(ready,'utf8'));
      assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
    } finally {
      watcher.close();
      if (fs.existsSync(ready)) {
        const pid = Number(fs.readFileSync(ready,'utf8'));
        try {process.kill(pid,'SIGKILL');await new Promise(resolve=>setTimeout(resolve,100));}
        catch (error) {if(error.code !== 'ESRCH')throw error;}
      }
    }
  });
});
