import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {listenOnLoopback} from '../server.mjs';

function serverWith(errors) {
  const server=new EventEmitter();let calls=0;
  server.listen=(port,host)=>{
    assert.ok(port>=49152&&port<=65535);
    assert.equal(host,'127.0.0.1');
    const code=errors[calls++];
    queueMicrotask(()=>code?server.emit('error',Object.assign(new Error(code),{code})):server.emit('listening'));
  };
  return {server,calls:()=>calls};
}

test('loopback listener uses safe ports and retries busy or excluded ports',async()=>{
  const probe=serverWith(['EADDRINUSE','EACCES']);
  await listenOnLoopback(probe.server);assert.equal(probe.calls(),3);
});

test('loopback listener stops after ten attempts',async()=>{
  const probe=serverWith(Array(10).fill('EADDRINUSE'));
  await assert.rejects(listenOnLoopback(probe.server),{code:'EADDRINUSE'});assert.equal(probe.calls(),10);
});

test('loopback listener reports other errors without retrying',async()=>{
  const probe=serverWith(['EINVAL']);
  await assert.rejects(listenOnLoopback(probe.server),{code:'EINVAL'});assert.equal(probe.calls(),1);
});
