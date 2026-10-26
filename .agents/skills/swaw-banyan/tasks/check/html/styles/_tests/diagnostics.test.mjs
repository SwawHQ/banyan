import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspect} from '../inspect.mjs';

test('diagnostic body markers require prose and shared styles at any route',async()=>{
  const parent=path.join(os.tmpdir(),'swaw/banyan/diagnostic-style-tests');
  fs.mkdirSync(parent,{recursive:true});
  const root=fs.mkdtempSync(path.join(parent,'run-'));
  try {
    fs.mkdirSync(path.join(root,'css'));
    for(const name of ['page','prose'])fs.writeFileSync(path.join(root,'css',name+'.css'),'');
    fs.writeFileSync(path.join(root,'index.html'),'<html><head><link rel="canonical" href="https://example.test/"><link rel="stylesheet" href="/css/page.css"></head><body></body></html>');
    const directory=path.join(root,'custom/diagnostics');
    fs.mkdirSync(directory,{recursive:true});
    const file=path.join(directory,'index.html');
    const write=(body,proseStyle=false)=>fs.writeFileSync(file,'<html><head><link rel="stylesheet" href="/css/page.css">'+
      (proseStyle?'<link rel="stylesheet" href="/css/prose.css">':'')+'</head>'+body+'</html>');
    write('<body data-prefetch-debug><pre>state</pre></body>');
    assert.ok((await inspect(root)).issues.includes('custom/diagnostics/index.html: template-rendered <pre> blocks must load prose.css.'));
    write('<body data-prefetch-debug><main class="prose"><pre>state</pre></main></body>');
    assert.ok((await inspect(root)).issues.includes('custom/diagnostics/index.html: template-rendered <pre> blocks must load prose.css.'));
    write('<body data-prefetch-debug><main class="prose"><pre>state</pre></main></body>',true);
    assert.deepEqual((await inspect(root)).issues,[]);
    write('<body><div data-prefetch-debug></div></body>');
    assert.deepEqual((await inspect(root)).issues,[],'Only the body marks a diagnostic page');
    write('<body data-prefetch-debug-copy="labels"></body>');
    assert.deepEqual((await inspect(root)).issues,[],'A longer attribute name is not the diagnostic marker');
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(parent));
    fs.rmSync(root,{recursive:true,force:true});
  }
});
