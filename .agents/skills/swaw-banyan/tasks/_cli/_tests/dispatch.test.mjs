import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('CLI executes tasks in its own Node process',{skip:!process.env.SWBAN_TEST_DEV},async()=>{
  const cli=fileURLToPath(new URL('../main.mjs',import.meta.url));
  const child=spawn(process.execPath,[cli,'base/node','-e','console.log(process.ppid)'],{stdio:['ignore','pipe','pipe']});
  let output='',errors='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
  const status=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
  assert.equal(status,0,errors);assert.equal(Number(output.trim()),child.pid);
});
