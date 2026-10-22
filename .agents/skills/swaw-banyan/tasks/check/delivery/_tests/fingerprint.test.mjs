import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspect} from '../inspect.mjs';
import {generatedHeaders} from '../../../_shared/headers.mjs';
import {verifyCspOutput} from '../../csp/verify.mjs';
import {discoverSite} from '../../browser/site/discover.mjs';
import {siteScenarios} from '../../browser/site/scenarios.mjs';

const digest='a'.repeat(64),image='photo.'+digest+'.webp';
const headers='/*\n  Cache-Control: public, max-age=900\n/assets/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable\n';
const routes=[{path:'/assets/*',bucket:'fingerprinted'},{path:'/*',bucket:'versioned'}];

async function fixture(run) {
  const directory=path.join(os.tmpdir(),'swaw/banyan/fingerprint-tests');
  await fs.mkdir(directory,{recursive:true});
  const parent=await fs.realpath(directory),root=await fs.mkdtemp(path.join(parent,'run-'));
  const write=async(name,body='')=>{const file=path.join(root,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,body);};
  try {await run({root,write});}
  finally {assert.equal(path.dirname(await fs.realpath(root)),parent);await fs.rm(root,{recursive:true,force:true});}
}

test('delivery checks policy fingerprints while permitting ordinary attachment formats',()=>fixture(async({root,write})=>{
  await write('_headers',headers);await write('_redirects','# no redirects');
  await write('sw-policy.json',JSON.stringify(routes));
  await write('index.html');await write('sw.js');await write('sw-version.json','{}');
  await write('assets/'+image,'These bytes intentionally do not match the filename hash.');
  for(const file of ['section/_map.toml','download.zip','downloads/manual.pdf','api/feed.json',
    'photos/raw.png','downloads/README','downloads/data.bin'])await write(file);
  const result=await inspect(root);
  assert.deepEqual(result.issues,[]);assert.equal(result.summary.fingerprinted,1);
  assert.ok(result.warnings.some(value=>value.includes('EdgeOne Makers')));
  await write('assets/raw.png');await write('elsewhere/'+image);
  const failed=await inspect(root);
  assert.equal(failed.summary.missingFingerprint,1);assert.equal(failed.summary.outsideFingerprint,1);
  assert.equal(failed.issues.length,2);
}));

test('classification honors SW priority, CF unset, encoded paths and HTML aliases',()=>fixture(async({root,write})=>{
  await write('_headers',headers+'/assets/live.json\n  ! Cache-Control\n  Cache-Control: no-cache\n'+
    '/%E4%B8%AD/*\n  ! Cache-Control\n  Cache-Control: immutable\n'+
    '/article/\n  ! Cache-Control\n  Cache-Control: immutable\n');
  await write('_redirects','');
  await write('sw-policy.json',JSON.stringify([
    {path:'/assets/live.json',bucket:'off'},{path:'/%E4%B8%AD/*',bucket:'fingerprinted'},
    {path:'/article/',bucket:'fingerprinted'},...routes]));
  await write('assets/live.json');await write('中/'+image);await write('article/index.html');
  const result=await inspect(root);
  assert.equal(result.summary.missingFingerprint,1);
  assert.ok(result.issues.some(value=>value.includes('article/index.html')));
  assert.equal(result.issues.length,1,'The no-cache JSON endpoint must not add an error.');
}));

for(const cacheControl of ['public, max-age=31536000, immutable','no-cache','public, max-age=900']) {
  for(const bucket of ['fingerprinted','versioned','off']) {
    test('fingerprint paths use either policy: HTTP '+cacheControl+', SW '+bucket,()=>fixture(async({root,write})=>{
      const expected=cacheControl.includes('immutable')||bucket==='fingerprinted';
      await write('_headers','/assets/*\n  Cache-Control: '+cacheControl+'\n');
      await write('_redirects','');
      await write('sw-policy.json',JSON.stringify([{path:'/assets/*',bucket}]));
      await write('assets/'+image);
      const hashed=await inspect(root);
      assert.equal(hashed.summary.missingFingerprint,0);
      assert.equal(hashed.summary.outsideFingerprint,expected?0:1);
      assert.equal(hashed.issues.length,expected?0:1);
      await write('assets/raw.png');
      const mixed=await inspect(root);
      assert.equal(mixed.summary.missingFingerprint,expected?1:0);
      assert.equal(mixed.summary.outsideFingerprint,expected?0:1);
      assert.equal(mixed.issues.length,1);
    }));
  }
}

test('a later SW off rule does not cancel HTTP immutable classification',()=>fixture(async({root,write})=>{
  await write('_headers',headers);await write('_redirects','');
  await write('sw-policy.json',JSON.stringify([{path:'/assets/*',bucket:'off'},...routes]));
  await write('assets/raw.png');
  const result=await inspect(root);
  assert.equal(result.summary.missingFingerprint,1);assert.equal(result.issues.length,1);
}));

test('Cloudflare extensionless HTML URLs participate in policy checks',()=>fixture(async({root,write})=>{
  await write('_headers','/*\n  Cache-Control: no-cache\n/contact\n  ! Cache-Control\n  Cache-Control: immutable\n');
  await write('_redirects','');await write('contact.html');
  const result=await inspect(root);
  assert.equal(result.summary.missingFingerprint,1);
  assert.ok(result.issues.some(value=>value.includes('contact.html')));
}));

test('a published base path applies to file URLs and HTML aliases across policies',()=>fixture(async({root,write})=>{
  await write('_headers',headers.replaceAll('/assets/', '/base/assets/')+
    '/base/article/\n  ! Cache-Control\n  Cache-Control: immutable\n');
  await write('_redirects','');
  await write('sw-policy.json',JSON.stringify([{path:'/base/article/',bucket:'fingerprinted'},
    ...routes.map(rule=>({...rule,path:'/base'+rule.path}))]));
  await write('edgeone.json',JSON.stringify({installCommand:'',buildCommand:'hugo',outputDirectory:'public',
    nodeVersion:'22.11.0',hugoVersion:'0.157.0',redirects:[],headers:[{source:'/base/assets/*',
      headers:[{key:'Cache-Control',value:'immutable'}]},{source:'/base/article/',headers:[{key:'Cache-Control',value:'immutable'}]}]}));
  await write('assets/'+image);
  for(const basePath of ['/base/','/base'])assert.deepEqual((await inspect(root,{basePath})).issues,[]);
  await write('assets/raw.png');await write('article/index.html');await write('elsewhere/'+image);
  const result=await inspect(root,{basePath:'/base/'});
  assert.equal(result.summary.missingFingerprint,2);assert.equal(result.summary.outsideFingerprint,1);
}));

test('file URL encoding preserves reserved path characters and escapes percent and fragments',()=>fixture(async({root,write})=>{
  const directories=['a+b&c=1,[x]@;$!()','a%b#/中'];
  await write('sw-policy.json',JSON.stringify(directories.map(directory=>({bucket:'fingerprinted',
    path:'/base+site/assets/'+(directory==='a%b#/中'?'a%25b%23/%E4%B8%AD':directory)+'/*'}))));
  for(const directory of directories)await write('assets/'+directory+'/'+image);
  assert.deepEqual((await inspect(root,{basePath:'/base+site/'})).issues,[]);
  await write('assets/'+directories[0]+'/raw.png');
  assert.equal((await inspect(root,{basePath:'/base+site/'})).summary.missingFingerprint,1);
}));

test('delivery CLI accepts a base path and rejects malformed or repeated arguments',()=>fixture(async({root,write})=>{
  const entry=fileURLToPath(new URL('../entry.mjs',import.meta.url));
  const cli=args=>spawnSync(process.execPath,[entry,...args],{cwd:root,encoding:'utf8',timeout:10000});
  const help=cli(['--help']);assert.equal(help.status,0);assert.match(help.stdout,/--base-path/);
  await write('sw-policy.json',JSON.stringify([{path:'/base/assets/*',bucket:'fingerprinted'}]));
  await write('assets/'+image);
  for(const args of [[root,'--base-path','/base/'],['--base-path=/base/',root]]) {
    const result=cli(args);assert.equal(result.status,0,result.stderr);
    assert.equal(JSON.parse(result.stdout.trim().split('\n').at(-1)).outsideFingerprint,0);
  }
  for(const args of [['--base-path'],['--base-path',''],['--base-path','/base/','--base-path','/other/'],
    ['--base-path','//host/'],['--base-path','/base/*'],['--base-path','/base/?q=1'],
    ['--base-path','/base/#part'],['--base-path','/bad%'],[root,root],['--unknown']]) {
    const result=cli(args);assert.equal(result.status,1,JSON.stringify(args));assert.ok(result.stderr.trim());
  }
}));

test('empty rules, missing channels and incomplete CF output remain distinct',()=>fixture(async({root,write})=>{
  await write('index.html');
  const missing=await inspect(root);
  assert.equal(missing.summary.complete,false);assert.ok(missing.warnings.some(value=>value.includes('no SW or HTTP')));
  await write('sw-policy.json','[]');await write('elsewhere/'+image);
  assert.equal((await inspect(root)).summary.outsideFingerprint,1);
  await write('_headers',headers);
  assert.ok((await inspect(root)).issues.some(value=>value.includes('both _headers and _redirects')));
}));

test('EdgeOne overlap is reported as uncertain and redirects retain order',()=>fixture(async({root,write})=>{
  const edge={installCommand:'',buildCommand:'hugo',outputDirectory:'public',nodeVersion:'22.11.0',hugoVersion:'0.157.0',
    headers:[{source:'/*',headers:[{key:'Cache-Control',value:'max-age=900'}]},
      {source:'/assets/*',headers:[{key:'Cache-Control',value:'immutable'}]}],
    redirects:[{source:'/old/',destination:'/new/',statusCode:301}]};
  await write('edgeone.json',JSON.stringify(edge));await write('assets/raw.png');
  const result=await inspect(root);
  assert.equal(result.summary.uncertainPaths,1);assert.equal(result.summary.missingFingerprint,0);
  assert.ok(result.warnings.some(value=>value.includes('overlapping Cache-Control')));
  await write('_headers',headers);await write('_redirects','/old/ /other/ 301');
  assert.ok((await inspect(root)).issues.some(value=>value.includes('redirects differ')));
}));

test('invalid output is a format failure and large fault lists stay bounded',()=>fixture(async({root,write})=>{
  await write('sw-policy.json','{');
  assert.ok((await inspect(root)).issues.some(value=>value.includes('sw-policy.json')));
  await write('sw-policy.json',JSON.stringify(routes));
  for(let i=0;i<30;i++)await write('assets/raw-'+i+'.png');
  const result=await inspect(root);
  assert.equal(result.summary.missingFingerprint,30);
  assert.equal(result.issues.length,11);assert.ok(result.issues.at(-1).includes('20 additional'));
}));

test('EdgeOne overlapping values with the same immutable classification still check filenames',()=>fixture(async({root,write})=>{
  const edge={installCommand:'',buildCommand:'hugo',outputDirectory:'public',nodeVersion:'22.11.0',hugoVersion:'0.157.0',redirects:[],
    headers:[{source:'/*',headers:[{key:'Cache-Control',value:'max-age=900, immutable'}]},
      {source:'/assets/*',headers:[{key:'Cache-Control',value:'max-age=31536000, immutable'}]}]};
  await write('edgeone.json',JSON.stringify(edge));await write('assets/raw.png');
  const result=await inspect(root);
  assert.equal(result.summary.missingFingerprint,2);assert.equal(result.summary.uncertainPaths,0);
  assert.ok(result.issues.some(value=>value.startsWith('assets/raw.png:')));
  assert.ok(result.warnings.some(value=>value.includes('merge not verified')));
}));

test('static CSP verifies either HTTP platform and still rejects differences',()=>fixture(async({root,write})=>{
  const inline='void 0;',hash=createHash('sha256').update(inline).digest('base64');
  const policy="default-src 'self'; script-src 'self' 'sha256-"+hash+"'";
  const xml="default-src 'none'; style-src 'unsafe-inline'; img-src data:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'";
  await write('index.html','<script>'+inline+'</script>');
  await write('_headers','/*\n  Content-Security-Policy: '+policy+'\n/*.xml\n  Content-Security-Policy: '+xml+'\n');
  assert.equal(verifyCspOutput(root).inlineScripts,1);
  const edge={headers:[{source:'/*',headers:[{key:'Content-Security-Policy',value:policy}]},
    {source:'/*.xml',headers:[{key:'Content-Security-Policy',value:xml}]}]};
  await write('edgeone.json',JSON.stringify(edge));
  assert.equal(verifyCspOutput(root).inlineScripts,1);
  await fs.unlink(path.join(root,'_headers'));
  assert.equal(verifyCspOutput(root).inlineScripts,1);
  await write('_headers',"/*\n  Content-Security-Policy: default-src 'none'\n/*.xml\n  Content-Security-Policy: "+xml+'\n');
  assert.throws(()=>verifyCspOutput(root),/policies must agree/);
}));

test('shared readers accept one HTTP platform and browser suites expose missing CF simulation',()=>fixture(async({root,write})=>{
  await write('index.html','<html lang=en><body><main class=slot-main>Home</main></body></html>');
  await write('_headers',headers);
  const cf=await generatedHeaders(root);assert.ok(cf.text);assert.equal(cf.edge,null);
  await fs.unlink(path.join(root,'_headers'));
  await write('edgeone.json','{"headers":[]}');
  const eo=await generatedHeaders(root);assert.equal(eo.text,null);assert.deepEqual(eo.edge,[]);
  const site=await discoverSite(root);
  assert.match(siteScenarios(site,{timeout:1000}).find(value=>value.id==='csp').skipReason,/not simulated/);
  await write('edgeone.json','null');
  await assert.rejects(()=>generatedHeaders(root),/must contain a headers array/);
  await fs.unlink(path.join(root,'edgeone.json'));
  assert.throws(()=>verifyCspOutput(root),/HTTP CSP not checked/);
}));
