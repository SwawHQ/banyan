import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {inspectHtmlBudget,inspectShareImageBudget,maxShareImageBytes} from './output/budget.mjs';
import {verifyRetiredOutput} from './output/retired.mjs';
import {inspect as inspectShareImage} from '../.agents/skills/swaw-banyan/tasks/check/img/share/inspect.mjs';

const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/output-tests'),budget=fileURLToPath(new URL('./output/budget.mjs',import.meta.url));
let work,count=0;
function write(root,name,text) {
  const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);
}
function fixture(body='') {
  const directory=path.join(work,String(++count));
  write(directory,'index.html','<html lang=en><head><title>Fixture</title><link rel=canonical href="https://example.test/"></head><body>'+body+'</body></html>');
  write(directory,'_headers','/*\n  Cache-Control: no-cache\n');
  write(directory,'edgeone.json','{"headers":[]}');
  return directory;
}
before(()=>{fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('repository HTML budgets keep raw and gzip failures outside published checks',async()=>{
  const small=fixture();assert.deepEqual((await inspectHtmlBudget(small)).issues,[]);
  const raw=fixture('x'.repeat(22000));
  assert.match((await inspectHtmlBudget(raw)).issues.join('\n'),/home raw HTML exceeded budget/);
  const text=Array.from({length:260},(_,index)=>createHash('sha256').update(String(index)).digest('hex')).join('');
  const compressed=await inspectHtmlBudget(fixture(text));
  assert.match(compressed.issues.join('\n'),/home gzip HTML exceeded budget/);
  assert.doesNotMatch(compressed.issues.join('\n'),/raw HTML exceeded/);
  for(const [directory,status] of [[small,0],[raw,1]]) {
    const result=spawnSync(process.execPath,[budget,directory],{cwd:work,encoding:'utf8',timeout:10000});
    assert.ifError(result.error);assert.equal(result.status,status,result.stdout+result.stderr);
  }
});

test('breadcrumb payload and collection source budgets remain repository contracts',async()=>{
  const directory=fixture();
  const sources=JSON.stringify([{f:['href'],rv:['/one/']},{f:['href'],rv:['/two/']}]).replaceAll('"','&quot;');
  for(const name of ['articles-all','articles','products-all','products']) {
    write(directory,name+'/index.html','<html lang=en><body data-entry-breadcrumb-sources="'+sources+'"></body></html>');
    assert.ok((await inspectHtmlBudget(directory)).issues.some(issue=>issue.startsWith(name+' breadcrumb source count exceeded budget')));
  }
  const large=JSON.stringify([{value:'x'.repeat(65536)}]).replaceAll('"','&quot;');
  write(directory,'article/index.html','<html lang=en><body data-entry-breadcrumb-sources="'+large+'"></body></html>');
  assert.match((await inspectHtmlBudget(directory)).issues.join('\n'),/site-wide limit/);
});

test('share image validity and repository size budgets fail independently',async()=>{
  const src='/media/content/pixel.jpg',directory=fixture('<meta property=og:image content="'+src+'"><meta name=twitter:image content="'+src+'">');
  const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAEf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=','base64');
  write(directory,src.slice(1),jpeg);
  assert.deepEqual((await inspectShareImage(directory)).issues,[]);
  assert.deepEqual((await inspectShareImageBudget(directory)).issues,[]);
  write(directory,src.slice(1),Buffer.concat([jpeg,Buffer.alloc(maxShareImageBytes)]));
  assert.deepEqual((await inspectShareImage(directory)).issues,[],'A valid image can exceed a repository budget.');
  assert.equal((await inspectShareImageBudget(directory)).issues.length,1,'OG and Twitter references share one resource budget.');
  write(directory,src.slice(1),'invalid JPEG');
  assert.match((await inspectShareImage(directory)).issues.join('\n'),/not a readable JPEG/);
  assert.deepEqual((await inspectShareImageBudget(directory)).issues,[]);
});

test('source guards reject retired controls without rejecting text or similar class names',async()=>{
  await verifyRetiredOutput(fixture('<pre>site-nav-utilities</pre><div class=site-nav-utilities-extra></div>'));
  await assert.rejects(verifyRetiredOutput(fixture('<div class="custom site-nav-utilities"></div>')),/Retired settings controls/);
});
