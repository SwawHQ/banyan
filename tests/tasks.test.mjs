import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';

const source = fileURLToPath(new URL('../.agents/skills/swaw-banyan/',import.meta.url));
const temporaryRoot = path.resolve(os.tmpdir());
let work,skill,site,server,origin;
let requests = 0;
const hash = body => createHash('sha256').update(body).digest('base64');
const inline = 'globalThis.fixture = true;';
const external = 'void 0;';
const xmlPolicy = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'";

function write(root,name,body) {
  const file = path.join(root,name);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,body);
}
function cli(command,args=[],options={}) {
  const result = spawnSync(process.execPath,[path.join(skill,'scripts.js/swban.mjs'),command,...args],{
    cwd:site,encoding:'utf8',timeout:10000,...options
  });
  assert.ifError(result.error);
  return result;
}
function cliAsync(command,args=[],options={}) {
  return new Promise((resolve,reject) => {
    const child = spawn(process.execPath,[path.join(skill,'scripts.js/swban.mjs'),command,...args],{
      cwd:site,stdio:['ignore','pipe','pipe'],...options
    });
    let stdout = '',stderr = '';
    const timer = setTimeout(() => child.kill(),10000);
    child.stdout.on('data',chunk => { stdout += chunk; });
    child.stderr.on('data',chunk => { stderr += chunk; });
    child.on('error',error => { clearTimeout(timer); reject(error); });
    child.on('close',status => { clearTimeout(timer); resolve({status,stdout,stderr}); });
  });
}
function externalSite(name,text) {
  const root = path.join(site,name);
  write(root,'data/external-resources.yaml',text.replaceAll('ORIGIN',origin));
  return root;
}
function output(name) {
  const directory = path.join(site,name);
  fs.cpSync(path.join(site,'public'),directory,{recursive:true});
  return directory;
}
function snapshot(root) {
  return fs.readdirSync(root,{recursive:true}).sort().flatMap(name => {
    const file = path.join(root,name);
    return fs.statSync(file).isFile() ? [[name,hash(fs.readFileSync(file))]] : [];
  });
}

before(async () => {
  work = fs.mkdtempSync(path.join(temporaryRoot,'banyan-tasks-'));
  skill = path.join(work,'skill with spaces 树');
  site = path.join(work,'caller site');
  fs.mkdirSync(skill);
  fs.mkdirSync(site);
  for (const name of fs.readdirSync(source)) {
    if (name !== '.tools' && name !== 'node_modules') {
      fs.cpSync(path.join(source,name),path.join(skill,name),{recursive:true,filter:file => !file.split(path.sep).includes('node_modules')});
    }
  }
  const runtime = process.versions.bun ? 'bun' : 'node';
  const {writeBindings} = await import(pathToFileURL(path.join(skill,'scripts.js/_toolchain/bindings.mjs')).href);
  writeBindings({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.bun ?? process.versions.node}
  }},path.join(skill,'.tools'));
  const policy = `default-src 'self'; script-src 'self' 'sha256-${hash(inline)}'`;
  const headers = [['/*',policy],['/*.xml',xmlPolicy]];
  write(site,'public/_headers',headers.map(([route,value]) => `${route}\n  Content-Security-Policy: ${value}`).join('\n\n'));
  write(site,'public/edgeone.json',JSON.stringify({headers:headers.map(([source,value]) => ({
    source,headers:[{key:'Content-Security-Policy',value}]
  }))}));
  write(site,'public/js/main.0123456789abcdef.js',external);
  write(site,'public/css/page.0123456789abcdef.css','body{color:black}');
  write(site,'public/sitemap.xml','<urlset><url><loc>https://example.test/</loc></url></urlset>');
  write(site,'public/robots.txt','User-agent: *\nSitemap: https://example.test/sitemap.xml');
  write(site,'public/llms.txt','# Fixture\nCanonical site: https://example.test/\n## Agent Notes\n- Canonical human-facing pages are HTML.\n## Key Content Pages\n- [Home](https://example.test/)\nSitemap: https://example.test/sitemap.xml');
  write(site,'public/index.html',`<!doctype html><html lang=en><head><title>Fixture</title><meta name=description content="Fixture home"><link rel=canonical href="https://example.test/"><link rel=stylesheet href="/css/page.0123456789abcdef.css"></head><body><h1>Fixture</h1><time data-site-update-version title=v20261008120000 datetime=2026-10-08T12:00:00Z>2026-10-08 12:00</time><script>${inline}</script><script src="/js/main.0123456789abcdef.js" integrity="sha256-${hash(external)}"></script></body></html>`);
  write(site,'data/external-resources.yaml','resources: []');
  server = createServer((request,response) => {
    requests++;
    response.setHeader('Content-Type','application/json');
    if (request.url === '/json') response.end(JSON.stringify({ModernDistributions:[],details:{version:1},pad:'x'.repeat(2200)}));
    else if (request.url === '/small') response.end('{}');
    else if (request.url === '/empty') response.end();
    else if (request.url === '/bad-json') response.end('invalid JSON');
    else { response.statusCode = 503; response.end('unavailable'); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (!work) return;
  assert.equal(path.dirname(work),temporaryRoot);
  assert.ok(path.basename(work).startsWith('banyan-tasks-'));
  fs.rmSync(work,{recursive:true,force:true});
});

test('task directories are the route; selected engine preserves arguments, streams, cwd and exit code',() => {
  write(skill,'tasks/probe/nested/entry.mjs',`import fs from 'node:fs';
    console.log(JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),engine:process.execPath,input:fs.readFileSync(0,'utf8')}));
    console.error('task stderr'); process.exitCode=19;`);
  const args = ['', 'space value', '树', 'quote"value', 'trailing\\'];
  const result = cli('probe/nested',args,{input:'task stdin'});
  assert.equal(result.status,19);
  assert.equal(result.stderr.trim(),'task stderr');
  const data = JSON.parse(result.stdout);
  assert.deepEqual(data.args,args);
  assert.equal(fs.realpathSync(data.cwd),fs.realpathSync(site));
  assert.equal(fs.realpathSync(data.engine),fs.realpathSync(process.execPath));
  assert.equal(data.input,'task stdin');
});

test('only entry.mjs creates a task; underscore prefixes do not hide tasks',() => {
  write(skill,'tasks/_private/helper.mjs','throw new Error("must not run");');
  write(skill,'tasks/js-only/entry.js','throw new Error("must not run");');
  for (const name of ['check','_private','js-only']) {
    const result = cli(name);
    assert.equal(result.status,1);
    assert.match(result.stderr,/unknown_command:/);
  }
  write(skill,'tasks/_named/entry.mjs','console.log("underscore entry");');
  assert.equal(cli('_named').stdout.trim(),'underscore entry');
  write(skill,'tasks/probe.webkit/entry.mjs','console.log("explicit WebKit entry");');
  assert.equal(cli('probe.webkit').stdout.trim(),'explicit WebKit entry');
});

test('routing cannot leave the tasks directory through traversal or a directory link',() => {
  const outside = path.join(work,'outside');
  write(outside,'entry.mjs','console.log("escaped");');
  fs.symlinkSync(outside,path.join(skill,'tasks/linked'),process.platform === 'win32' ? 'junction' : 'dir');
  try {
    for (const name of ['../outside','check/../html','check\\html','/check/html','linked','probe..webkit','probe.webkit.','probe/.webkit','probe//webkit']) {
      const result = cli(name);
      assert.equal(result.status,1);
      assert.match(result.stderr,/unknown_command:/);
      assert.doesNotMatch(result.stdout,/escaped/);
    }
  } finally { fs.unlinkSync(path.join(skill,'tasks/linked')); }
});

test('task execution leaves published output and tool bindings unchanged',() => {
  const files = snapshot(path.join(site,'public'));
  const bindings = snapshot(path.join(skill,'.tools'));
  for (const command of ['check/csp','check/sri','check/html/metadata','check/html/headings','check/html/jsonld','check/html/scripts','check/html/styles','check/html/breadcrumb','check/sitemap','check/robots','check/llms','check/build-version','check/prefetch/payload','check/prefetch/rules','check/img/icons','check/img/share','check/img/responsive','report/size/html','report/size/js','report/size/assets','report/payload/breadcrumb','report/payload/prefetch','deploy/edgeone/sync','sync/ext']) {
    const result = cli(command);
    assert.equal(result.status,0,result.stdout + result.stderr);
  }
  assert.deepEqual(snapshot(path.join(site,'public')),files);
  assert.deepEqual(snapshot(path.join(skill,'.tools')),bindings);
});

test('CSP and SRI reject their own defects independently',() => {
  const inlineOutput = output('inline changed');
  const html = fs.readFileSync(path.join(inlineOutput,'index.html'),'utf8');
  write(inlineOutput,'index.html',html.replace(inline,inline+'void 1;'));
  const result = cli('check/csp',[inlineOutput]);
  assert.equal(result.status,1);
  assert.match(result.stderr,/CSP does not allow final inline script/);
  const assetOutput = output('asset changed');
  write(assetOutput,'js/main.0123456789abcdef.js','changed();');
  assert.equal(cli('check/csp',[assetOutput]).status,0);
  const assetResult = cli('check/sri',[assetOutput]);
  assert.equal(assetResult.status,1);
  assert.match(assetResult.stderr,/Script integrity differs from published bytes/);
});

test('metadata checking fails on findings while size reporting stays independent',() => {
  const directory = output('bad seo');
  const html = fs.readFileSync(path.join(directory,'index.html'),'utf8');
  write(directory,'index.html',html.replace('<title>Fixture</title>','<title></title>'));
  const checked = cli('check/html/metadata',[directory]);
  assert.equal(checked.status,1);
  assert.match(checked.stderr,/Missing browser title/);
  assert.equal(cli('check/html/jsonld',[directory]).status,0);
  const reported = cli('report/size/html',[directory,'--top','1']);
  assert.equal(reported.status,0,reported.stderr);
  assert.doesNotMatch(reported.stdout,/Missing browser title/);
  assert.match(reported.stdout,/top 1/);
});

test('size reporting accepts a page larger than repository budgets',() => {
  const directory = output('large page');
  const html = fs.readFileSync(path.join(directory,'index.html'),'utf8');
  write(directory,'index.html',html.replace('<body>','<body>'+'x'.repeat(22000)));
  assert.equal(cli('report/size/html',[directory]).status,0);
});

test('report top limits accept both forms and reject partial integers or duplicate directories',() => {
  assert.equal(cli('report/size/html',['--top=1']).status,0);
  for (const args of [['--top'],['--top','0'],['--top','2x'],['--top=1.5'],['--top','9007199254740992'],['public','other'],['--check']]) {
    assert.equal(cli('report/size/html',args).status,1);
  }
});

test('output tasks reject duplicate directories and missing output',() => {
  for (const command of ['check/csp','check/sri','check/html/metadata','report/size/html','report/size/assets']) {
    for (const args of [['public','extra'],['missing-output']]) {
      assert.equal(cli(command,args).status,1);
    }
  }
});

test('EdgeOne sync accepts another build directory, copies exact bytes and preserves unchanged mtime',() => {
  const directory = output('edgeone alternative');
  const sourceBytes = fs.readFileSync(path.join(directory,'edgeone.json'));
  const result = cli('deploy/edgeone/sync',[directory]);
  assert.equal(result.status,0,result.stderr);
  const target = path.join(site,'edgeone.json');
  assert.deepEqual(fs.readFileSync(target),sourceBytes);
  fs.utimesSync(target,new Date('2020-01-01'),new Date('2020-01-01'));
  const before = fs.statSync(target).mtimeMs;
  assert.match(cli('deploy/edgeone/sync',[directory]).stdout,/already in sync/);
  assert.equal(fs.statSync(target).mtimeMs,before);
});

test('EdgeOne sync keeps the root config when a build is missing or JSON is invalid',() => {
  const before = fs.readFileSync(path.join(site,'edgeone.json'));
  const directory = output('edgeone invalid');
  for (const invalid of ['not JSON','[]','null']) {
    write(directory,'edgeone.json',invalid);
    assert.equal(cli('deploy/edgeone/sync',[directory]).status,1);
    assert.deepEqual(fs.readFileSync(path.join(site,'edgeone.json')),before);
  }
  assert.equal(cli('deploy/edgeone/sync',['absent-build']).status,1);
});

test('external sync uses bundled YAML, selects ids and preserves identical files without site npm',async () => {
  const root = externalSite('external success',`resources:
  - id: first
    source: >-
      ORIGIN/json
    target: content/files/data.json
    validators: ["json:details.version", "min-size:2KiB", "max-size:1MB"]
  - id: second
    source: ORIGIN/json
    target: assets/second.json
    validators: [json]
`);
  const beforeRequests = requests;
  const result = await cliAsync('sync/ext',['first'],{cwd:root});
  assert.equal(result.status,0,result.stderr);
  assert.equal(requests,beforeRequests+1);
  assert.equal(fs.existsSync(path.join(root,'assets/second.json')),false);
  assert.equal(fs.existsSync(path.join(root,'package.json')),false);
  assert.equal(fs.existsSync(path.join(root,'node_modules')),false);
  const target = path.join(root,'content/files/data.json');
  assert.equal(JSON.parse(fs.readFileSync(target)).details.version,1);
  fs.utimesSync(target,new Date('2020-01-01'),new Date('2020-01-01'));
  const mtime = fs.statSync(target).mtimeMs;
  const unchanged = await cliAsync('sync/ext',['first'],{cwd:root});
  assert.equal(unchanged.status,0,unchanged.stderr);
  assert.match(unchanged.stdout,/already up to date/);
  assert.equal(fs.statSync(target).mtimeMs,mtime);
  assert.equal((await cliAsync('sync/ext',[],{cwd:root})).status,0);
  assert.equal(fs.existsSync(path.join(root,'assets/second.json')),true);
  assert.equal(fs.readdirSync(path.dirname(target)).some(name => name.startsWith('.swban-')),false);
});

test('download or content validation failures leave the existing resource untouched',async () => {
  for (const [index,source,validators] of [
    [0,'/bad-json','[json]'],[1,'/empty','[]'],[2,'/small','["min-size:2KiB"]'],
    [3,'/json','["max-size:2KiB"]'],[4,'/fail','[json]'],[5,'/json','["json:absent"]']
  ]) {
    const root = externalSite('external failure '+index,`resources:
  - id: item
    source: ORIGIN${source}
    target: content/item.json
    validators: ${validators}
`);
    write(root,'content/item.json','original bytes');
    const result = await cliAsync('sync/ext',[],{cwd:root});
    assert.equal(result.status,1,result.stdout + result.stderr);
    assert.equal(fs.readFileSync(path.join(root,'content/item.json'),'utf8'),'original bytes');
    assert.deepEqual(fs.readdirSync(path.join(root,'content')),['item.json']);
  }
});

test('invalid declarations fail before downloading or writing any selected resource',async () => {
  const item = `id: item\n    source: ORIGIN/json\n    target: content/item.json`;
  const cases = [
    ['duplicate id',`resources:\n  - ${item}\n  - ${item}`],
    ['duplicate target',`resources:\n  - ${item}\n  - id: other\n    source: ORIGIN/json\n    target: content/item.json`],
    ['duplicate yaml key',`resources:\n  - ${item}\n    id: other`],
    ['invalid validator',`resources:\n  - ${item}\n    validators: ["max-size:2x"]`],
    ['unsupported field',`resources:\n  - ${item}\n    validator: json`],
    ['unknown id',`resources:\n  - ${item}`,'absent']
  ];
  for (const [name,text,id] of cases) {
    const root = externalSite('declaration '+name,text);
    const before = requests;
    const result = await cliAsync('sync/ext',id ? [id] : [],{cwd:root});
    assert.equal(result.status,1,result.stdout + result.stderr);
    assert.equal(requests,before);
    assert.equal(fs.existsSync(path.join(root,'content')),false);
  }
});

test('external targets cannot escape the site or modify generated output and tool directories',async () => {
  for (const [index,target] of ['../escape.json','public/item.json','.git/item','.agents/item','node_modules/item'].entries()) {
    const root = externalSite('target rejection '+index,`resources:
  - id: item
    source: ORIGIN/json
    target: ${target}
`);
    const before = requests;
    const result = await cliAsync('sync/ext',[],{cwd:root});
    assert.equal(result.status,1,result.stdout + result.stderr);
    assert.equal(requests,before);
    assert.deepEqual(fs.readdirSync(root),['data']);
  }
  const root = externalSite('target link',`resources:
  - id: item
    source: ORIGIN/json
    target: content/link/item.json
`);
  const outside = path.join(work,'external target');
  write(outside,'item.json','keep outside');
  fs.mkdirSync(path.join(root,'content'));
  fs.symlinkSync(outside,path.join(root,'content/link'),process.platform === 'win32' ? 'junction' : 'dir');
  try {
    const before = requests;
    assert.equal((await cliAsync('sync/ext',[],{cwd:root})).status,1);
    assert.equal(requests,before);
    assert.equal(fs.readFileSync(path.join(outside,'item.json'),'utf8'),'keep outside');
  } finally { fs.unlinkSync(path.join(root,'content/link')); }
});
