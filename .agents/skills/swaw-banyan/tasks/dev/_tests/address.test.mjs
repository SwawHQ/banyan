import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addressOptions,developmentAddress} from '../address.mjs';

test('environment variables remain available to Hugo unless a flag overrides them',()=>{
  const saved={HUGO_ENVIRONMENT:process.env.HUGO_ENVIRONMENT,HUGO_ENV:process.env.HUGO_ENV};
  try {
    for(const environment of [{},{HUGO_ENVIRONMENT:'preview'},{HUGO_ENV:'preview'},{HUGO_ENVIRONMENT:'preview',HUGO_ENV:'other'}]) {
      delete process.env.HUGO_ENVIRONMENT;delete process.env.HUGO_ENV;
      Object.assign(process.env,environment);
      const defaults=Object.keys(environment).length?[]:['--environment','development'];
      assert.deepEqual(addressOptions([]).configArgs,defaults);
      for(const flags of [['--environment','staging'],['--environment=staging'],['-e','staging']])
        assert.deepEqual(addressOptions(flags).configArgs,[...defaults,'--environment','staging']);
    }
  } finally {
    for(const [key,value] of Object.entries(saved)) {
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
});

test('address options forward configuration selectors without server flags',()=>{
  const options=addressOptions(['--port','8123','--config=custom.toml','-e','preview','-s../site','-Dbhttps://example.test/sub/','--bind','::','--tlsAuto=false','--appendPort=false']);
  assert.deepEqual(options.configArgs,[...addressOptions([]).configArgs,'--config','custom.toml','--environment','preview','--source','../site','--baseURL','https://example.test/sub/']);
  assert.equal(options.tls,false);
  assert.equal(options.appendPort,false);
});

test('development addresses preserve paths and explicit base URLs',()=>{
  const config={baseurl:'https://published.test/docs/'};
  const address=(flags=[],cfg=config,port=8123)=>developmentAddress(cfg,addressOptions(flags),port);
  assert.equal(address(),'http://localhost:8123/docs/');
  assert.equal(address(['--baseURL','http://preview.test:9000/sub']),'http://preview.test:8123/sub/');
  assert.equal(address(['--baseURL=//preview.test/sub/']),'http://preview.test:8123/sub/');
  assert.equal(address(['--appendPort=false']),'http://localhost/docs/');
  assert.equal(address(['-bhttp://preview.test:9000/sub/','--appendPort=false']),'http://preview.test:9000/sub/');
  assert.equal(address(['--tlsAuto']),'https://localhost:8123/docs/');
  assert.equal(address(['--tlsCertFile','cert.pem','--tlsKeyFile=key.pem']),'https://localhost:8123/docs/');
  assert.equal(address(['--tlsCertFile','cert.pem']),'http://localhost:8123/docs/');
  assert.equal(address([],{}),'http://localhost:8123/');
  assert.equal(address([],{languages:{en:{baseurl:'https://en.test/'},zh:{baseurl:'https://zh.test/'}}}),null);
});
