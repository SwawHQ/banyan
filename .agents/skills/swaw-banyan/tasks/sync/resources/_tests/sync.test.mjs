import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {writeSiteFile} from '../../../_shared/files.mjs';

async function site(t) {
  const parent = path.join(os.tmpdir(),'swaw/banyan/resource-tests');
  await fs.mkdir(parent,{recursive:true});
  const root = await fs.mkdtemp(path.join(parent,'site-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  return root;
}

test('a target created during download requires --force',async t=>{
  const root = await site(t);
  const file = path.join(root,'data.txt');
  const copy = fs.copyFile.bind(fs);
  t.mock.method(fs,'copyFile',async(source,destination,flags)=>{
    await fs.writeFile(destination,'local');
    return copy(source,destination,flags);
  });
  await assert.rejects(writeSiteFile(root,'data.txt',Buffer.from('remote')),/--force/);
  assert.equal(await fs.readFile(file,'utf8'),'local');
  assert.deepEqual(await fs.readdir(root),['data.txt']);
});
