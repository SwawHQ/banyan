import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspect} from '../inspect.mjs';

test('main follows document navigation while independent pages retain their own controllers',async()=>{
  const parent=path.join(os.tmpdir(),'swaw/banyan/navigation-script-tests');
  fs.mkdirSync(parent,{recursive:true});
  const root=fs.mkdtempSync(path.join(parent,'run-'));
  try {
    fs.mkdirSync(path.join(root,'js/pages'),{recursive:true});
    const main='<script src="/js/main.fixture.js"></script>';
    const retry='<script src="/js/pages/reload.fixture.js"></script>';
    fs.writeFileSync(path.join(root,'js/main.fixture.js'),'void 0;');
    fs.writeFileSync(path.join(root,'js/pages/reload.fixture.js'),'void 0;');
    const write=(body,content)=>fs.writeFileSync(path.join(root,'index.html'),
      body+'<head><link rel="canonical" href="https://example.test/"></head><body>'+content+'</body></html>');
    write('<html data-navigation="{}">',main);
    assert.deepEqual((await inspect(root)).issues,[]);
    write('<html data-navigation="{}">','');
    assert.match((await inspect(root)).issues.join('\n'),/Navigation controller main: expected 1, found 0/);
    write('<html data-navigation="{}">',main+main);
    assert.match((await inspect(root)).issues.join('\n'),/Navigation controller main: expected 1, found 2/);
    write('<html>',main);
    assert.match((await inspect(root)).issues.join('\n'),/Navigation controller main: expected 0, found 1/);
    write('<html data-navigation-copy="labels">','<div data-navigation></div>');
    assert.deepEqual((await inspect(root)).issues,[],'Only the exact root attribute declares navigation.');
    const actions='<p data-page-actions><a data-page-action="reload" href="/">Retry</a></p>';
    write('<html>',actions+retry);
    assert.deepEqual((await inspect(root)).issues,[]);
    write('<html>',actions);
    assert.match((await inspect(root)).issues.join('\n'),/Controller loading boundary pages\/reload: expected 1, found 0/);
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(parent));
    fs.rmSync(root,{recursive:true,force:true});
  }
});
