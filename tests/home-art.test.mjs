import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment,fixtureSiteFiles} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {loadChromium} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {check as checkHome} from '../.agents/skills/swaw-banyan/tasks/check/browser/home/check.mjs';
import {inspect as inspectStyles} from '../.agents/skills/swaw-banyan/tasks/check/html/styles/inspect.mjs';
import {inspect as inspectSri} from '../.agents/skills/swaw-banyan/tasks/check/sri/inspect.mjs';
import {inspect as inspectDelivery} from '../.agents/skills/swaw-banyan/tasks/check/delivery/inspect.mjs';
import {verifyCspOutput} from '../.agents/skills/swaw-banyan/tasks/check/csp/verify.mjs';
import {extractBlocks} from '../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {extractStartTags,extractTagAttribute,decodeHtmlAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/home-art');
const languages=[['','en'],['zh/','zh'],['ar/','ar']];
const entry=config=>'{{< art-wind >}}'+JSON.stringify(config)+'{{< /art-wind >}}';
let work,site;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
const suffix=language=>language==='en'?'':'.'+language;
function home(index,body,extra='') {
  return '---\ntitle: Home identity '+index+'\ndescription: Home description '+index+'\nlayout: page-home\nparams:\n  icon: home\n  browser_title: Browser identity '+index+'\n'+extra+'---\n\n'+body+'\n';
}
function prepare(name) {
  const source=path.join(work,name);fixtureSiteFiles(source);
  write(path.join(source,'hugo.toml'),fs.readFileSync(path.join(root,'hugo.toml'),'utf8'));
  write(path.join(source,'go.mod'),'module fixture.invalid/home-art\n\ngo 1.18\n\nrequire github.com/SwawHQ/banyan/module v0.0.0\n\n'+
    'replace github.com/SwawHQ/banyan/module => '+JSON.stringify(path.join(root,'module').replaceAll('\\','/'))+'\n');
  for(const [,language] of languages) write(path.join(source,'content/home/index'+suffix(language)+'.md'),'---\ntitle: Welcome\nurl: home/\nlayout: page-home\n---\n'+entry({brand_line:'Welcome'}));
  return source;
}
function homes(source,body='',extra='') {
  for(const [index,[,language]] of languages.entries())
    write(path.join(source,'content/_index'+suffix(language)+'.md'),home(index,typeof body==='function'?body(language):body,typeof extra==='function'?extra(language):extra));
}
function build(name,body='',source=site,extra='') {
  homes(source,body,extra);
  const output=path.join(work,name),result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--destination',output],
    {cwd:source,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000,windowsHide:true});
  assert.ifError(result.error);return {output,result};
}
function passed(name,body,source,extra) {
  const {output,result}=build(name,body,source,extra);assert.equal(result.status,0,result.stdout+result.stderr);return output;
}
const htmlAt=(output,prefix)=>fs.readFileSync(path.join(output,prefix,'index.html'),'utf8');
async function checked(output) {
  assert.deepEqual((await inspectStyles(output)).issues,[]);assert.deepEqual((await inspectSri(output)).issues,[]);
  assert.deepEqual((await inspectDelivery(output)).issues,[]);verifyCspOutput(output);
}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));site=prepare('source');
});
after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync(work)),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('the language root always opens with navigation only',async()=>{
  const output=passed('plain-home',language=>language==='en'?'Plain home.':'',site,language=>language==='en'?'  show_navigation: false\n':'');
  for(const [prefix] of languages) {
    const html=htmlAt(output,prefix);
    assert.doesNotMatch(html,/art-wind/);
    assert.ok(!html.includes('reading-group'));
    assert.ok(!extractStartTags(html,'div').some(tag=>extractTagAttribute(tag,'class').split(/\s+/).includes('page-content')));
    const [main]=extractBlocks(html,'div',tag=>extractTagAttribute(tag,'id')==='main');
    assert.equal(extractTagAttribute(main.open,'role'),'main');
    assert.ok(main.inner.includes('data-root-navigation'));
    assert.equal(extractStartTags(html,'nav').filter(tag=>tag.includes('data-root-navigation')).length,1);
    assert.equal(extractTagAttribute(extractStartTags(html,'body')[0],'data-home-navigation'),'true');
    assert.equal(extractStartTags(html,'div').filter(tag=>extractTagAttribute(tag,'class').split(/\s+/).includes('page-rail')).length,1);
  }
  await checked(output);
});

test('navigation-only home passes the browser check and the skip link reaches navigation',async()=>{
  const server=await createStaticSiteServer(passed('navigation-only','')),chromium=loadChromium();
  let browser;
  try {
    await server.start();
    browser=await chromium.launch({executablePath:chromium.executablePath()});
    const page=await browser.newPage();
    await checkHome({page,baseUrl:server.getBaseUrl()});
    assert.ok(await page.locator('#main [data-root-navigation]').isVisible());
    assert.equal(await page.locator('.page-content').count(),0);
    await page.locator('.skip-link').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'main');
    const selected=page.locator('[data-root-navigation] [aria-current="page"]');
    assert.equal(await selected.count(),0);
    await page.locator('[data-root-href="/home/"]').click();
    assert.equal(await selected.getAttribute('href'),'/home/');
    assert.ok(await page.locator('[data-art="wind"]').isVisible());
    // Root entries must collapse even before the deferred main bundle is available.
    await page.route('**/js/main.*.js', route => route.abort());
    await page.reload();
    await selected.click();
    await page.waitForURL(server.getBaseUrl()+'/');
    assert.equal(await selected.count(),0);
    await page.goBack();assert.equal(await selected.getAttribute('href'),'/home/');
  } finally {await browser?.close();await server.stop();}
});

test('wind uses local JSON, scopes multiple instances and loads shared assets once',async()=>{
  const article=path.join(site,'content/demo/index.md');
  const label='<em>Wind & sun</em>',url='https://example.org/?a=1&b=2';
  write(article,'---\ntitle: Demo\nurl: demo/\nlayout: page-article-norss\n---\n'+entry({heading:label,signals:[{name:label,url}]})+'\n\n'+entry({signals:['Second'],wind_field_start_offset_rem:8}));
  const output=passed('scenes',lang=>lang==='en'?entry({brand_line:'Home wind'}):'Plain home.');
  const articleHtml=htmlAt(output,'demo'), windSections=extractStartTags(articleHtml,'section').filter(tag=>extractTagAttribute(tag,'data-art')==='wind');
  assert.equal(windSections.length,2);
  const ids=windSections.map(tag=>extractTagAttribute(tag,'id'));assert.equal(new Set(ids).size,2);
  assert.equal(extractStartTags(articleHtml,'script').filter(tag=>tag.includes('/js/art-wind.')).length,1);
  const styles=extractStartTags(articleHtml,'link').map(tag=>extractTagAttribute(tag,'href'));
  assert.equal(styles.filter(href=>href.includes('/css/art-wind.')).length,1);
  for(const [index,id] of ids.entries()) {
    const css=fs.readFileSync(path.join(output,styles.find(href=>href.includes('/'+id+'.'))),'utf8');
    assert.ok(css.includes('#'+id));assert.ok(css.includes('field-start-offset:'+(index?8:6)+'rem'));
    assert.ok(articleHtml.includes('url(#'+id+'-clip)'));
  }
  const heading=extractBlocks(articleHtml,'h2',tag=>extractTagAttribute(tag,'id')===ids[0]+'-title')[0];
  assert.equal(decodeHtmlAttribute(heading.inner),label);assert.doesNotMatch(heading.inner,/<em>/);
  assert.ok(extractStartTags(articleHtml,'a').some(tag=>extractTagAttribute(tag,'href')===url));
  assert.doesNotMatch(htmlAt(output,''),/Home wind|art-wind/);assert.doesNotMatch(htmlAt(output,'zh'),/art-wind/);
  await checked(output);
  const server=await createStaticSiteServer(output),chromium=loadChromium();
  let browser;
  try {
    await server.start();
    browser=await chromium.launch({executablePath:chromium.executablePath()});
    const page=await browser.newPage();await page.goto(server.getBaseUrl()+'/demo/');
    const titles=page.locator('.prose .home-art-wind__anchor-title');
    assert.equal(await titles.count(),2);
    for(const title of await titles.all()) {
      assert.equal(await title.evaluate(node=>getComputedStyle(node).marginBlockStart),'0px');
      assert.ok(await title.evaluate(node=>node.getBoundingClientRect().bottom<=node.closest('[data-art]').getBoundingClientRect().bottom));
    }
    for(const id of ids) await page.locator('#'+id+' [data-home-art-wind-signal]').dispatchEvent('click');
    assert.equal(await page.locator('.home-art-wind__signal.is-selected').count(),2);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.home-art-wind__signal.is-selected').count(),0);
  } finally {await browser?.close();await server.stop();}
});

test('wind reports invalid signal fields',()=>{
  const {result}=build('invalid',entry({signals:[{name:'Docs',href:'/docs/'}]}));
  assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/unsupported signal field.*href/);
});
