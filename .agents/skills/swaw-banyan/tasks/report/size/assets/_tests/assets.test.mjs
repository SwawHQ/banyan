import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('asset reports group short and full fingerprints with correct file counts and bytes',async()=>{
  const parent=await fs.realpath(os.tmpdir()),root=await fs.mkdtemp(path.join(parent,'swban-assets-'));
  try {
    const files=[
      ['short.1234abcd.js','a'],
      ['md5.'+'a'.repeat(32)+'.js','bc'],
      ['sha1.'+'a'.repeat(40)+'.js','def'],
      ['sha256.'+'a'.repeat(64)+'.js','ghij'],
      ['plain.js','klmno'],
      ['seven.123abcd.js','pqrstu'],
      ['invalid.'+'z'.repeat(64)+'.js','vwxyzAB']
    ];
    await Promise.all(files.map(([name,body])=>fs.writeFile(path.join(root,name),body)));
    const entry=fileURLToPath(new URL('../entry.mjs',import.meta.url));
    const result=spawnSync(process.execPath,[entry,root],{cwd:root,encoding:'utf8',timeout:10000,windowsHide:true});
    assert.ifError(result.error);assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,/^Files\t7$/m);assert.match(result.stdout,/^Bytes\t28$/m);
    assert.match(result.stdout,/^hasHash=true\text=\.js\t4\t10\t/m);
    assert.match(result.stdout,/^hasHash=false\text=\.js\t3\t18\t/m);
  } finally {
    assert.equal(path.dirname(await fs.realpath(root)),parent);
    assert.ok(path.basename(root).startsWith('swban-assets-'));
    await fs.rm(root,{recursive:true,force:true});
  }
});
