import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {readHugoConfig} from '../../_shared/hugo.mjs';

test('native dev indexes once, serves edits, skips indexing and retains output',{skip:!process.env.SWBAN_TEST_DEV,timeout:90000},async()=>{
  const parent=path.join(os.tmpdir(),'swaw/banyan/dev-tests');fs.mkdirSync(parent,{recursive:true});
  const root=fs.mkdtempSync(path.join(parent,'site-'));
  const write=(name,text)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  write('hugo.toml','baseURL = "http://example.org/"\n');
  write('layouts/home.html','<!doctype html><html lang="en"><title>Home</title><body><article>{{ range site.RegularPages }}{{ .Title }} {{ .Content }}{{ end }}</article></body></html>');
  write('layouts/single.html','<!doctype html><html lang="en"><title>{{ .Title }}</title><body><article>{{ .Content }}</article></body></html>');
  write('content/draft.md','---\ntitle: Draft\ndraft: true\n---\nFirst searchable content.\n');
  write('static/site/search-index.json',JSON.stringify({base:'http://example.org/',groups:[{source:'**/*.html',root:'/',selector:'article'}]}));
  const module=new URL('../run.mjs',import.meta.url).href;
  try {
    write('preview.toml','baseURL = "https://preview.test/docs/"\npublishDir = "preview-output"\n');
    write('config/preview/hugo.toml','baseURL = "https://example.org/preview/"\n');
    write('config/staging/hugo.toml','baseURL = "https://example.org/staging/"\n');
    const configuration=await readHugoConfig(root,'',['--environment','development','--config','preview.toml']);
    assert.equal(configuration.baseurl,'https://preview.test/docs/');
    const scenarios=[
      {pagefind:true,flags:['--quiet'],suffix:'/'},
      {flags:['--config','preview.toml'],suffix:'/docs/',publishDir:'preview-output',pagefind:true},
      {environment:{HUGO_ENVIRONMENT:'preview'},suffix:'/preview/'},
      {environment:{HUGO_ENV:'preview'},suffix:'/preview/'},
      {environment:{HUGO_ENVIRONMENT:'preview',HUGO_ENV:'staging'},suffix:'/preview/'},
      {environment:{HUGO_ENVIRONMENT:'preview'},flags:['--environment','staging'],suffix:'/staging/'},
      {environment:{HUGO_ENVIRONMENT:'preview'},flags:['-e','staging'],suffix:'/staging/'},
    ];
    for(const {pagefind=false,flags=[],suffix,environment={},publishDir='public'} of scenarios) {
      const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
      const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
      const code=`import {main} from ${JSON.stringify(module)}; process.on('message',()=>process.emit('SIGINT')); process.argv=[process.execPath,'dev','--port','${port}',...${JSON.stringify(flags)}]; try {await main({pagefind:${pagefind}});} finally {process.disconnect();}`;
      const env={...process.env};delete env.HUGO_ENVIRONMENT;delete env.HUGO_ENV;
      const child=spawn(process.execPath,['--input-type=module','-e',code],{cwd:root,env:{...env,...environment},stdio:['ignore','pipe','pipe','ipc']});
      let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
      const exit=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
      const wait=async predicate=>{for(let i=0;i<200;i++){if(await predicate())return;assert.equal(child.exitCode,null,output);await delay(100);}assert.fail(output);};
      const destination=path.join(root,publishDir);
      try {
        await wait(()=>output.includes(pagefind?'Search index ready':'Pagefind skipped'));
        const address=`http://localhost:${port}${suffix}`;
        await wait(()=>output.includes(`[swban] ${address}`));
        assert.ok(output.indexOf(`[swban] ${address}`)>output.indexOf(pagefind?'Search index ready':'Pagefind skipped'));
        if(!pagefind)assert.ok(output.includes(`Web Server is available at ${address}`),output);
        assert.ok(fs.existsSync(path.join(destination,'index.html')),output);
        const url=`http://127.0.0.1:${port}${suffix.slice(0,-1)}`;
        const response=await fetch(url+'/draft/');assert.equal(response.status,200);
        assert.match(response.headers.get('cache-control'),/no-store/);
        const index=await fetch(url+'/pagefind/pagefind-entry.json');assert.equal(index.status,pagefind?200:404);
        if(pagefind) {
          const before=await index.text();
          write('content/draft.md','---\ntitle: Draft\ndraft: true\n---\nUpdated searchable content.\n');
          await wait(async()=>/Updated searchable/.test(await (await fetch(url+'/draft/')).text()));
          assert.equal(await (await fetch(url+'/pagefind/pagefind-entry.json')).text(),before);
          assert.equal(output.split('Search index ready').length,2);
        }
      } finally {if(child.connected)child.send('SIGINT');await exit;}
      assert.ok(fs.existsSync(path.join(destination,'index.html')),'output must remain after exit');
      assert.ok(destination.startsWith(root+path.sep));
      fs.rmSync(destination,{recursive:true,force:true});
    }
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
