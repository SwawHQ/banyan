import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {searchArguments,sourceGlobs} from '../search.mjs';

test('source globs expand directories and preserve native patterns',()=>{
  assert.deepEqual(sourceGlobs(['p/','docs/**/*.html'],'zh/'),['zh/p/**/*.html','zh/docs/**/*.html']);
  assert.deepEqual(sourceGlobs('*.html'),['*.html']);
  assert.deepEqual(sourceGlobs('**/*.html'),['**/*.html']);
  for(const source of [[],['rss'],'selector','*','a.txt','../','/p/','C:/p/','a/../../',42])
    assert.throws(()=>sourceGlobs(source),/Search source/);
});

test('search file selection preserves subpaths and rejects invalid selections',()=>{
  const parent=path.join(os.tmpdir(),'swaw/banyan/search-selection');fs.mkdirSync(parent,{recursive:true});
  const root=fs.mkdtempSync(path.join(parent,'run-'));
  try {
    assert.equal(searchArguments(root),null);
    fs.mkdirSync(path.join(root,'site'));fs.mkdirSync(path.join(root,'zh/post'),{recursive:true});
    fs.writeFileSync(path.join(root,'zh/post/index.html'),'<article>body</article>');
    const file=path.join(root,'site/search-index.json');
    const write=groups=>fs.writeFileSync(file,JSON.stringify({base:'https://example.org/sub/',groups:groups.map(g=>({source:'rss',root:'/sub/zh/',...g}))}));
    write([{selector:'.article .prose',urls:['/sub/zh/post/']}]);
    const args=searchArguments(root);assert.equal(args.at(-1),'zh/post/index.html');assert.equal(args[5],'.article .prose');
    write([{selector:'.article',urls:['https://other.org/sub/zh/post/']}]);
    assert.throws(()=>searchArguments(root),/outside site/);
    write([{selector:'.article',urls:['/sub/zh/post/']},{selector:'main',urls:[]}]);
    assert.throws(()=>searchArguments(root),/same nonempty/);
    write([{selector:'.article',urls:[]}]);assert.deepEqual(searchArguments(root),[]);
    write([{selector:'.article',source:['p/','docs/**/*.html']}]);
    assert.equal(searchArguments(root).at(-1),'{zh/p/**/*.html,zh/docs/**/*.html}');
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
