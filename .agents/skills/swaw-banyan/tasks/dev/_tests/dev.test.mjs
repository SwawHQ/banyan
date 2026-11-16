import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {serverArguments,listening,serving} from '../run.mjs';

test('dev preserves Hugo arguments and resolves the final bind and port',()=>{
  for(const flags of [['--port','8123'],['--port=8123'],['-p','8123'],['-p8123'],['-p=8123'],['-Dp8123']]) {
    const input=[...flags,'--bind=0.0.0.0','--buildDrafts=false','--baseURL','http://example.test/sub/'];
    const result=serverArguments(input,'/temporary/site');
    assert.equal(result.port,8123);assert.equal(result.bind,'0.0.0.0');
    assert.deepEqual(result.args.slice(-input.length),input);
  }
  assert.equal(serverArguments([],'').bind,'127.0.0.1');
  assert.equal(serverArguments([],'',{lan:true}).bind,'::');
  assert.equal(serverArguments(['-p8000','--port=9000'],'').port,9000);
});

test('dev rejects output overrides and invalid ports before starting tools',()=>{
  for(const flags of [['--destination','content'],['-dcontent'],['-Ddcontent'],['--renderToMemory'],['--renderStaticToDisk'],['--cleanDestinationDir'],['--port=0'],['--port=65536'],['-p'],['--bind']])
    assert.throws(()=>serverArguments(flags,''));
});

test('readiness waits for HTTP, not just a reserved TCP listener',async()=>{
  const sockets=new Set();
  const server=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  try {
    assert.equal(await listening(port,'127.0.0.1'),true);
    assert.equal(await serving(port,'127.0.0.1'),false);
  } finally {for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
  const web=http.createServer((req,res)=>{res.writeHead(404);res.end();});
  await new Promise(resolve=>web.listen(0,'127.0.0.1',resolve));
  try {assert.equal(await serving(web.address().port,'127.0.0.1'),true);}
  finally {await new Promise(resolve=>web.close(resolve));}
});
