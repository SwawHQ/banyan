import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment,fixtureSiteMounts} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {loadChromium,loadWebkit} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {afterPaint,waitForBrowse} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/viewport.mjs';
import {discoverSite} from '../.agents/skills/swaw-banyan/tasks/check/browser/site/discover.mjs';
import {normalizeFromPath,applyFromPathToUrl} from '../module/assets/js/browse/navigation-state.js';
import {parseNavigation,selectNavigationRoute} from '../module/assets/js/browse/navigation-source.js';
import {verifyCspOutput} from '../.agents/skills/swaw-banyan/tasks/check/csp/verify.mjs';
import {fitWallSize} from '../module/assets/js/browse/wall-fit.js';
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/wall-tests');
const sizes={portrait:{width:160,height:200},masonry:{width:200,height:'auto'},wide:{width:300,height:200},narrow:{width:40,height:200},'equal-height':{width:'auto',height:200}};
const layouts=Object.keys(sizes);
let work,content,output,config,server;
const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
const section=(layout='equal-height',scroll='horizontal',extra='')=>'---\ntitle: Wall fixture\ndescription: Wall integration fixture.\nlayout: page-collection-wall-all\nparams:\n  aggregate: /wall-source\n  slots: [breadcrumb]\n  wall:\n    size: '+JSON.stringify(sizes[layout])+'\n    details: title\n    scroll: '+scroll+'\n'+extra+'---\n';
function build(){return spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],{encoding:'utf8',env:fixtureEnvironment(work),windowsHide:true,timeout:90000});}
const passed=r=>{assert.ifError(r.error);assert.equal(r.status,0,r.stdout+r.stderr);};
before(async()=>{
 fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));console.log('Wall artifacts: '+work);
 content=path.join(work,'content');output=path.join(work,'public');config=path.join(work,'wall.toml');
 const engine=loadChromium(),browser=await engine.launch({headless:true,executablePath:engine.executablePath()});
 try {
  const page=await browser.newPage();
  for(let n=0;n<12;n++) {
   if(n%4!==3) {
    const png=await page.evaluate(n=>{const c=document.createElement('canvas');c.width=[600,240,800][n%3];c.height=[400,640,200][n%3];const x=c.getContext('2d');const g=x.createLinearGradient(0,0,c.width,c.height);g.addColorStop(0,'#18434a');g.addColorStop(1,'#ded6b2');x.fillStyle=g;x.fillRect(0,0,c.width,c.height);return c.toDataURL().split(',')[1];},n);
    write(path.join(content,`wall-source/item-${n}/cover.png`),Buffer.from(png,'base64'));
   }
   for(const suffix of ['', '.zh','.ar'])write(path.join(content,`wall-source/item-${n}/index${suffix}.md`),'---\ntitle: Wall item '+n+' with a deliberately long title\nurl: p/wall-item-'+n+'/\ndate: 2026-10-'+String(20-n).padStart(2,'0')+'\nlayout: page-article-norss\nparams:\n  slots: [breadcrumb]\n'+(n===2?'  wall: {kind: video}\n':'')+'---\nFixture body.\n');
  }
 }finally{await browser.close();}
 for(const suffix of ['', '.zh','.ar']) {
  write(path.join(content,'_index'+suffix+'.md'),section());
  write(path.join(content,'wall-source/_index'+suffix+'.md'),'---\ntitle: Source\nlayout: page-collection-directory\n---\n');
  for(const count of [1,2])for(const layout of layouts)for(const direction of ['horizontal','vertical']) {
   const target=path.join(content,`wall-sparse-${count}-${layout}-${direction}`);write(path.join(target,'_index'+suffix+'.md'),section(layout,direction).replace('layout: page-collection-wall-all','layout: page-collection-wall').replace('  aggregate: /wall-source\n',''));
   if(!suffix)write(path.join(target,'_map.toml'),'refs = '+JSON.stringify(Array.from({length:count},(_,n)=>'/wall-source/item-'+n))+'\n');
  }
  for(const mode of ['overlay','overlay-hover'])write(path.join(content,'wall-'+mode+'/_index'+suffix+'.md'),section().replace('details: title','details: '+mode));
  for(const [relative,details,scroll] of [['wall-tree','title','horizontal'],['wall-tree/branch','overlay','vertical'],['wall-tree/branch/leaf','overlay-hover','horizontal'],['wall-tree/empty','title','vertical']]) {
   write(path.join(content,relative,'_index'+suffix+'.md'),JSON.stringify({title:relative.split('/').at(-1),description:'Description for '+relative,layout:'page-collection-wall',params:{slots:['breadcrumb'],wall:{size:{width:'auto',height:200},details,scroll}}})+'\n');
   if(!suffix)write(path.join(content,relative,'_map.toml'),'refs = '+JSON.stringify(relative.endsWith('empty')?[]:['/wall-source/item-0','/wall-source/item-2'])+'\n');
  }
  for(const layout of layouts)for(const direction of ['horizontal','vertical'])write(path.join(content,`wall-${layout}-${direction}/_index${suffix}.md`),section(layout,direction));
 }
 fs.copyFileSync(path.join(content,'wall-source/item-1/cover.png'),path.join(content,'wall-tree/branch/cover.png'));
 write(config,'[[module.mounts]]\nsource='+JSON.stringify(content.replaceAll('\\','/'))+'\ntarget="content"\n[[module.mounts]]\nsource="content"\ntarget="content"\n'+fixtureSiteMounts);
 passed(build());verifyCspOutput(output);
 assert.equal((await discoverSite(output)).home,'/');
 const home=fs.readFileSync(path.join(output,'index.html'),'utf8');
 const covers=[...home.matchAll(/<img src=([^ >]+)/g)].map(match=>match[1].replaceAll('"',''));
 assert.ok(covers.length>0);
 assert.ok(covers.every(src=>src.startsWith('/media/content/')),JSON.stringify(covers));
 server=await createStaticSiteServer(output);await server.start();
});
after(async()=>{await server?.stop();if(work&&!process.env.BANYAN_KEEP_WALL_TEST){assert.equal(path.dirname(fs.realpathSync(work)),fs.realpathSync(parent));fs.rmSync(work,{recursive:true,force:true});}});
test('wall sizing keeps the maximum, fits within 20%, and shrinks only a lone oversized track further',()=>{
 assert.equal(fitWallSize(1000,240,16),238);assert.equal(fitWallSize(400,240,16),192);assert.equal(fitWallSize(280,240,16),240);
 assert.equal(fitWallSize(900,200,16,40),173);assert.equal(fitWallSize(900,200,16,40,1),200);assert.equal(fitWallSize(900,200,16,40,2),200);
 assert.equal(fitWallSize(120,200,16,40),80);assert.equal(fitWallSize(0,200,16,40),1);
});
test('home lineage is distinct from an absent source, including subpath deployments',()=>{
 assert.equal(normalizeFromPath(''),'');assert.equal(normalizeFromPath('/'),'/');
 const url=new URL('https://example.test/base/zh/p/item/');applyFromPathToUrl(url,'/');
 assert.equal(new URLSearchParams(url.hash.slice(1)).get('from'),'/');
 const navigation=parseNavigation(JSON.stringify({home:'/base/zh/',resources:'/base/site/navigation/',columns:{'/':'fixture'},default:''}));
 const route=selectNavigationRoute(navigation,'/');assert.equal(route.root,'/base/zh/');
 assert.deepEqual(route.columns,[{column:'/'}]);assert.equal(navigation.columns['/'].href,'/base/zh/');
});
test('missing covers prefer SVG, fall back to ICO, and fail without both',()=>{
 const original=fs.readFileSync(config,'utf8'),home=()=>fs.readFileSync(path.join(output,'index.html'),'utf8');
 assert.match(home(),/class=.?wall-placeholder-icon[^>]*favicon\.link[^>]*\.svg/);
 const assets=path.join(work,'icon-assets');fs.cpSync('assets',assets,{recursive:true});
 // The reference Powered by copy explicitly embeds SVG; isolate it from fallback checks.
 for(const suffix of ['', '.zh','.ar'])write(path.join(content,'powered-by/index'+suffix+'.md'),'---\ntitle: Powered by\nurl: powered-by/\nlayout: page-article-norss\n---\n');
 try {
  write(config,original.replace('source = "assets"\ntarget = "assets"','source = '+JSON.stringify(assets.replaceAll('\\','/'))+'\ntarget = "assets"'));
  fs.rmSync(path.join(assets,'site/favicon.link.svg'));passed(build());
  assert.match(home(),/class=.?wall-placeholder-icon[^>]*favicon[^>]*\.ico/);
  fs.rmSync(path.join(assets,'site/favicon.ico'));const result=build();assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/Wall: provide assets\/site\/favicon/);
 } finally {write(config,original);passed(build());}
});
test('wall validates options and can switch the home back to home-art',()=>{
 const home=path.join(content,'_index.md'),original=fs.readFileSync(home,'utf8');
 for(const [replace,expected] of [
  [s=>s.replace(/  wall:[\s\S]*?---/,'  wall: false\n---'),/params.wall must be a map/],
  [s=>s.replace('details: title','details: wrong'),/invalid params.wall.details/],
  [s=>s.replace('details: title','caption: title'),/unsupported params.wall.caption/],
  ...[[0,/size must be a map/],[{width:'auto',height:'auto'},/cannot both be auto/],[{width:200},/requires both/],[{width:0,height:200},/size.width must be/],[{width:true,height:200},/size.width must be/],[{width:'200',height:200},/size.width must be/],[{width:200,height:641},/size.height must be/],[{width:200,height:200,depth:1},/unsupported params.wall.size.depth/]].map(([value,error])=>[s=>s.replace(JSON.stringify(sizes['equal-height']),JSON.stringify(value)),error])
 ]) {write(home,replace(section()));const result=build();assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,expected);}
 write(home,'---\ntitle: Home\ndescription: Home fixture.\nlayout: page-home\n---\n{{< home-art "/_res/home-art/wind" >}}');passed(build());assert.match(fs.readFileSync(path.join(output,'index.html'),'utf8'),/data-home-art-source/);
 write(home,original);passed(build());
});
for(const engineName of ['chromium','webkit'])test(engineName+' wall layouts, RTL, details and homepage lineage',async()=>{
 const engine=engineName==='chromium'?loadChromium():loadWebkit();const browser=await engine.launch({headless:true,executablePath:engine.executablePath()});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const language of ['zh','ar'])for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000});
   for(const layout of layouts)for(const direction of ['horizontal','vertical']) {
    await page.goto(server.getBaseUrl()+`/${language}/wall-${layout}-${direction}/`);
    await page.waitForSelector('[data-wall-ready]');await waitForBrowse(page);await afterPaint(page);
    await page.locator('.wall-card').first().evaluate(el=>el.scrollIntoView({inline:'start',block:'nearest',behavior:'instant'}));
    const state=await page.evaluate(()=>{
     const cards=[...document.querySelectorAll('.wall-card')];return {rows:cards.map(c=>c.getBoundingClientRect().toJSON()),dates:cards.map(c=>+c.dataset.wallDate),images:cards.flatMap(c=>[...c.querySelectorAll('.wall-cover > img')].map(i=>({width:i.getBoundingClientRect().width,height:i.getBoundingClientRect().height,ratio:Number(i.getAttribute('width'))/Number(i.getAttribute('height'))}))),view:innerHeight};
    });
    for(const icon of await page.locator('.wall-placeholder-icon').all()){const box=await icon.boundingBox();assert.equal(box.width,32);assert.equal(box.height,32);}
    assert.equal(state.rows.length,12);assert.deepEqual(state.dates,[...state.dates].sort((a,b)=>b-a));
    for(let i=0;i<state.rows.length;i++)for(let j=i+1;j<state.rows.length;j++){const a=state.rows[i],b=state.rows[j];assert.ok(a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1,`${language} ${width} ${layout} ${direction}: overlap`);}
    if(direction==='horizontal')assert.ok(state.rows.every(r=>r.bottom<=state.view+1),`${layout}: bottom overflow`);
    if(sizes[layout].width!=='auto'&&sizes[layout].height!=='auto')for(const img of state.images)assert.ok(Math.abs(img.width/img.height-sizes[layout].width/sizes[layout].height)<.03,'configured crop ratio');
    if(layout==='equal-height'||layout==='masonry')for(const img of state.images)assert.ok(Math.abs(img.width/img.height-img.ratio)<.03,'original ratio');
    if(layout==='equal-height'&&direction==='vertical') {
     const available=await page.locator('.reading-group').evaluate(el=>parseFloat(el.style.getPropertyValue('--wall-width')));
     for(const img of state.images) {
      assert.ok(img.width<=available+1,'wide cards fit the available width');
      assert.ok(Math.abs(img.height-Math.min(200,available/img.ratio))<1,'only an oversized card shrinks; other cards keep their target height');
     }
    }
   }
   await page.goto(server.getBaseUrl()+`/${language}/`);await page.waitForSelector('[data-wall-ready]');await waitForBrowse(page);
   const first=page.locator('.wall-card').first();await first.evaluate(el=>el.scrollIntoView({inline:'start',block:'nearest'}));
   const trigger=first.locator('.wall-detail');await trigger.click();await page.waitForFunction(()=>document.querySelector('.wall-detail').getAttribute('aria-expanded')==='true');
   assert.equal(await first.locator('.wall-info:popover-open').count(),1);
   await first.locator('.wall-info-close').click();assert.equal(await trigger.evaluate(el=>document.activeElement===el),true);
   await trigger.press('Enter');await page.waitForSelector('.wall-info:popover-open');await trigger.press('Escape');
   if(engineName==='chromium')await page.screenshot({path:path.join(work,`${language}-${width}.png`)});
   await first.locator('.wall-cover').click();await page.waitForURL('**/p/wall-item-0/**');await waitForBrowse(page);
   assert.equal(new URL(page.url()).hash,'#from=/');
   await page.waitForSelector('[data-breadcrumb-column-path="/"]');
   assert.equal(await page.locator('[data-breadcrumb-column-path="/"] [data-list-entry]').count(),12);
   await page.goBack();await page.waitForSelector('[data-wall-ready]');
  }
  for(const language of ['zh','ar'])for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000});
   await page.goto(server.getBaseUrl()+'/'+language+'/wall-tree/');await page.waitForSelector('[data-wall-ready]');await waitForBrowse(page);
   assert.equal(await page.locator('[data-wall-kind="section"]').count(),2);
   assert.equal(await page.locator('[data-wall-kind="page"]').count(),2);
   const empty=page.locator('[data-wall-kind="section"]').filter({has:page.locator('.wall-cover[href$="/empty/"]')});
   assert.equal(await empty.locator('.wall-text-cover').textContent(),'Description for wall-tree/empty');
   assert.equal(await empty.locator('.wall-detail .icon').count(),1);assert.equal(await empty.locator('.wall-dots').count(),0);
   await empty.locator('.wall-detail').click();assert.equal(await empty.locator('.wall-info:popover-open').count(),1);
   assert.match(await empty.locator('.wall-info').textContent(),/0/);assert.match(await empty.locator('.wall-description').textContent(),/Description/);
   await empty.locator('.wall-info-close').click();
   for(const [part,depth] of [['branch',1],['leaf',2]]) {
    await page.locator('.wall-cover[href$="/'+part+'/"]').click();await page.waitForURL('**/'+part+'/');await page.waitForSelector('[data-wall-ready]');await waitForBrowse(page);await afterPaint(page);
    assert.equal(await page.locator('.breadcrumb-column').count(),depth);
    assert.equal(await page.locator('.breadcrumb-column .wall-card').count(),0);
    assert.equal(await page.locator('.wall-card-title').count(),0);assert.ok(await page.locator('.wall-dots').count()>0);
    const sizes=await page.evaluate(()=>({columns:[...document.querySelectorAll('.breadcrumb-column')].map(el=>el.getBoundingClientRect().width),wall:parseFloat(document.querySelector('.reading-group').style.getPropertyValue('--wall-width'))}));
    assert.ok(sizes.columns.every(w=>Math.abs(w-225)<1));
    if(width===1440)assert.ok(sizes.wall<1440-(depth+1)*225,'parent columns reduce available wall width');
   }
   const first=page.locator('.wall-card').first(),trigger=first.locator('.wall-detail');await trigger.focus();assert.equal(await trigger.evaluate(el=>getComputedStyle(el).opacity),'1');
   await trigger.click();await page.waitForSelector('.wall-info:popover-open');await trigger.press('Escape');
   await first.locator('.wall-cover').click();await page.waitForURL('**/p/wall-item-0/**');await waitForBrowse(page);assert.match(new URL(page.url()).hash,/from=wall-tree\/branch\/leaf/);
   assert.equal(await page.locator('.breadcrumb-column').count(),3);assert.equal(await page.locator('link[href*="collection-wall"],script[src*="collection-wall"]').count(),0);
   await page.locator('.breadcrumb-column').nth(1).locator('a[data-list-entry][href*="/leaf/"]').click();await page.waitForURL('**/leaf/**');await page.waitForSelector('[data-wall-ready]');
   await page.goto(server.getBaseUrl()+'/'+language+'/wall-tree/empty/');await page.waitForSelector('[data-wall-ready]');assert.equal(await page.locator('.wall-empty').isVisible(),true);
  }
  for(const count of [1,2])for(const layout of layouts)for(const direction of ['horizontal','vertical']) {
   await page.goto(server.getBaseUrl()+`/zh/wall-sparse-${count}-${layout}-${direction}/`);await page.waitForSelector('[data-wall-ready]');
   for(const viewport of [{width:390,height:850},{width:1678,height:2600},{width:780,height:600}]) {
    await page.setViewportSize(viewport);await afterPaint(page);
    const boxes=await page.locator('.wall-cover').evaluateAll(nodes=>nodes.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
    assert.equal(boxes.length,count);
    for(const box of boxes)for(const axis of ['width','height'])if(sizes[layout][axis]!=='auto')assert.ok(box[axis]<=sizes[layout][axis]+1,JSON.stringify({count,layout,direction,viewport,box,axis}));
   }
  }
  for(const mode of ['overlay','overlay-hover']) {
   await page.goto(server.getBaseUrl()+'/zh/wall-'+mode+'/');await page.waitForSelector('[data-wall-ready]');
   assert.equal(await page.locator('.wall-card-title').count(),0);assert.equal(await page.locator('.wall-dots').count(),12);
   const trigger=page.locator('.wall-detail').first();await trigger.focus();await trigger.press('Enter');await page.waitForSelector('.wall-info:popover-open');await trigger.press('Escape');
  }
  assert.deepEqual(errors,[]);await context.close();
 }finally{await browser.close();}
});
