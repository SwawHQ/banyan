import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {inspect} from '../inspect.mjs';

async function fixture(run) {
  const directory=path.join(os.tmpdir(),'swaw/banyan/robots-check-tests');
  await fs.mkdir(directory,{recursive:true});
  const parent=await fs.realpath(directory),root=await fs.mkdtemp(path.join(parent,'run-'));
  const write=text=>fs.writeFile(path.join(root,'robots.txt'),text);
  try {await run({root,write});}
  finally {assert.equal(path.dirname(await fs.realpath(root)),parent);await fs.rm(root,{recursive:true,force:true});}
}

test('absent and empty robots output is not checked',()=>fixture(async({root,write})=>{
  for(const text of [null,'',' \r\n\t']) {
    if(text!==null)await write(text);
    const result=await inspect(root);
    assert.deepEqual(result.issues,[]);
    assert.deepEqual(result.warnings,['robots.txt not checked: output is absent or empty.']);
  }
}));

test('robots allows named agents, optional records, comments and multiple Sitemap URLs',()=>fixture(async({root,write})=>{
  for(const text of [
    'User-agent: ExampleBot\nDisallow: /private/\n',
    'User-agent: *\nAllow: /\n',
    '# Sitemap: /ignored.xml\nCrawl-delay: 2\nCustom: any value\n'+
      '  sItEmAp : https://example.test/base/sitemap.xml # location\rSITEMAP: http://other.test/sitemap.xml\r\n'
  ]) {
    await write(text);assert.deepEqual(await inspect(root),{issues:[]});
  }
}));

test('each declared Sitemap must be an absolute HTTP(S) URL',()=>fixture(async({root,write})=>{
  for(const value of ['not a URL','/sitemap.xml','ftp://example.test/sitemap.xml','','https://','# no value']) {
    await write('Sitemap: https://example.test/valid.xml\nSitemap: '+value+'\n');
    const result=await inspect(root);
    assert.equal(result.issues.length,1,value);
    assert.match(result.issues[0],/Sitemap is not a valid absolute HTTP\(S\) URL/);
  }
}));
