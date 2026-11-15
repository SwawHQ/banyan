import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {build,buildArguments} from '../run.mjs';

test('build passes one destination to Hugo and Pagefind, and stops on failure',async()=>{
  const calls=[];
  const deps={configuration:async()=>({}),prepare:async names=>calls.push(names),executable:()=> 'pagefind',selection:destination=>['--site',destination,'--root-selector','.article .prose'],
    render:async args=>{calls.push(args);return 2;},index:async(exe,args,{cwd})=>{calls.push([exe,JSON.parse(fs.readFileSync(path.join(cwd,'pagefind.json'),'utf8'))]);return 3;}};
  const options={destination:'public',baseURL:'https://example.org/docs/'};
  assert.equal(await build(options,deps),2);assert.equal(calls.length,1);
  deps.render=async args=>{calls.push(args);return 0;};calls.length=0;
  assert.equal(await build(options,deps),3);
  assert.equal(calls[0][calls[0].indexOf('--destination')+1],path.resolve('public'));
  assert.deepEqual(calls[2],['pagefind',{site:path.resolve('public'),root_selector:'.article .prose'}]);
});
test('build rejects source and ancestor destinations',()=>{
  for(const destination of ['.','..',path.parse(process.cwd()).root,'content','module/output','.agents/output','layouts','static','data','i18n','config','.codex','.aws'])
    assert.throws(()=>buildArguments({destination}),/site source/);
});

test('build protects custom source directories and mounts before rendering',async()=>{
  for(const config of [{layoutdir:'custom-templates'},{module:{mounts:[{source:'custom-templates',target:'layouts'}]}},{languages:{zh:{contentdir:'custom-templates'}}}]) {
    assert.throws(()=>buildArguments({destination:'custom-templates'},process.cwd(),config),/site source/);
    await assert.rejects(build({destination:'custom-templates'},{configuration:async()=>config,render:()=>assert.fail('must not render')}),/site source/);
  }
});

test('build skips Pagefind for absent search and emits an empty entry for empty RSS',async()=>{
  const parent=path.join(os.tmpdir(),'swaw/banyan/build-tests');fs.mkdirSync(parent,{recursive:true});
  const work=fs.mkdtempSync(path.join(parent,'run-'));
  try {
    const deps={configuration:async()=>({}),render:async()=>0,prepare:()=>assert.fail('must not prepare Pagefind'),index:()=>assert.fail('must not index'),selection:()=>null};
    assert.equal(await build({destination:work},deps),0);
    deps.selection=()=>[];
    assert.equal(await build({destination:work},deps),0);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(work,'pagefind/pagefind-entry.json'),'utf8')),{languages:{}});
  } finally {fs.rmSync(work,{recursive:true,force:true});}
});
