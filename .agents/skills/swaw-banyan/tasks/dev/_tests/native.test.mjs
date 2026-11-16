import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

test('native dev indexes once, serves edits, skips indexing and cleans up',{skip:!process.env.SWBAN_TEST_DEV,timeout:90000},async()=>{
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
    for(const pagefind of [true,false]) {
      const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
      const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
      const code=`import {main} from ${JSON.stringify(module)}; process.on('message',()=>process.emit('SIGINT')); process.argv=[process.execPath,'dev','--port','${port}','--quiet']; try {await main({pagefind:${pagefind}});} finally {process.disconnect();}`;
      const child=spawn(process.execPath,['--input-type=module','-e',code],{cwd:root,stdio:['ignore','pipe','pipe','ipc']});
      let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
      const exit=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
      const wait=async predicate=>{for(let i=0;i<200;i++){if(await predicate())return;assert.equal(child.exitCode,null,output);await delay(100);}assert.fail(output);};
      let destination;
      try {
        await wait(()=>output.includes(pagefind?'Search index ready':'Pagefind skipped'));
        const match=/--destination (?:"([^"]+)"|(\S+))/.exec(output);assert.ok(match,output);destination=match[1]||match[2];
        const url=`http://127.0.0.1:${port}`;
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
      assert.equal(fs.existsSync(destination),false,'temporary output must be removed');
      assert.equal(fs.existsSync(path.join(root,'public')),false);
    }
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
