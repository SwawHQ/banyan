import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fixtureEnvironment,fixtureSiteFiles} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {loadChromium,loadWebkit} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {extractBlocks} from '../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {extractStartTags,extractTagAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';
import {filesUnder} from '../.agents/skills/swaw-banyan/tasks/_shared/output.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/responsive-images');
const pictures=[['large',3200,1800,[768,1200,1600]],['medium',1000,600,[768,1000]],['small',320,180,[320]]];
const route='/images/',sizes='auto, (max-width: 820px) calc(100vw - 32px), 800px';
let work,source,output,capped,server,timings,cacheSnapshot;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
const article=body=>'---\ntitle: Responsive image fixture\nurl: /images/\nlayout: page-article-norss\nparams: {share_image: false, slots: []}\n---\n\n'+body;
const markdown=pictures.map(([name])=>`![${name} fixture](${name}.png)`).join('\n\n')+'\n\n![Repeated large fixture](large.png)';
function build(name,environment=fixtureEnvironment(work),config='hugo.toml') {
  const destination=path.join(work,name),start=performance.now();
  const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config',config,'--destination',destination],
    {cwd:source,env:environment,encoding:'utf8',timeout:90000,windowsHide:true});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
  timings[name]=Math.round(performance.now()-start);return destination;
}
function images(directory) {
  const html=fs.readFileSync(path.join(directory,'images/index.html'),'utf8');
  return extractBlocks(html,'a',tag=>extractTagAttribute(tag,'class')==='md-image-link').map(block=>{
    const img=extractStartTags(block.inner,'img')[0],source=extractStartTags(block.inner,'source')[0];
    return {href:extractTagAttribute(block.open,'href'),src:extractTagAttribute(img,'src'),
      width:Number(extractTagAttribute(img,'width')),height:Number(extractTagAttribute(img,'height')),
      sizes:extractTagAttribute(img,'sizes'),sourceSizes:extractTagAttribute(source,'sizes'),
      candidates:extractTagAttribute(source,'srcset').split(',').map(value=>{
        const match=value.trim().match(/^(\S+) (\d+)w$/);assert.ok(match,'Each candidate declares its width.');
        return {url:match[1],width:Number(match[2])};
      })};
  });
}
async function cachedImages() {
  const snapshot=[];
  for(const directory of ['cache','resources']) {
    const location=path.join(work,directory);
    if(!fs.existsSync(location))continue;
    for(const file of await filesUnder(location,file=>file.endsWith('.webp')))snapshot.push([
      path.relative(work,file),fs.statSync(file).mtimeMs,createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    ]);
  }
  return snapshot;
}
before(async()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));source=path.join(work,'source');timings={};
  fixtureSiteFiles(source);
  write(path.join(source,'hugo.toml'),'disableLanguages = ["zh", "zh-tw", "ar"]\n'+fs.readFileSync(path.join(root,'hugo.toml'),'utf8'));
  write(path.join(source,'go.mod'),'module fixture.invalid/images\n\ngo 1.18\n\nrequire github.com/SwawHQ/banyan/module v0.0.0\n\n'+
    'replace github.com/SwawHQ/banyan/module => '+JSON.stringify(path.join(root,'module').replaceAll('\\','/'))+'\n');
  write(path.join(source,'content/_index.md'),'---\ntitle: Image fixture\ndescription: Isolated image processing fixture.\nlayout: page-home\nparams: {share_image: false}\n---\n\n{{< home-art "/_res/home-art/wind" >}}\n');
  const engine=loadChromium(),browser=await engine.launch({executablePath:engine.executablePath(),headless:true});
  try {
    const page=await browser.newPage();
    for(const [name,width,height] of pictures) {
      const png=await page.evaluate(({width,height})=>{
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,width,height);
        gradient.addColorStop(0,'#19364d');gradient.addColorStop(0.5,'#d9ba83');gradient.addColorStop(1,'#8b354e');
        ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
        for(let index=0;index<200;index++) {
          ctx.fillStyle=`hsl(${index*47%360} 65% 55% / 0.6)`;
          ctx.fillRect(index*83%width,index*127%height,Math.max(2,width/29),Math.max(2,height/31));
        }
        return canvas.toDataURL('image/png').split(',')[1];
      },{width,height});
      write(path.join(source,'content/images',name+'.png'),Buffer.from(png,'base64'));
    }
  } finally {await browser.close();}
  write(path.join(source,'content/images/index.md'),article('No image processing baseline.'));
  build('baseline',fixtureEnvironment(path.join(work,'baseline-cache')));
  write(path.join(source,'content/images/index.md'),article(markdown));
  output=build('cold');cacheSnapshot=await cachedImages();assert.ok(cacheSnapshot.length>=6,'Hugo keeps each processed variant in its cache.');
  const warm=build('warm');assert.deepEqual(await cachedImages(),cacheSnapshot,'Warm builds reuse processed image files without rewriting them.');
  assert.deepEqual(images(warm),images(output),'Warm builds publish the same candidate URLs.');
  write(path.join(source,'cap.toml'),'[params.media.responsive_images]\nwidths = [1000, 768, 768]\n');
  capped=build('capped',fixtureEnvironment(work),'hugo.toml,cap.toml');
  server=await createStaticSiteServer(output);await server.start();
},{timeout:180000});
after(async()=>{
  if(server)await server.stop();
  if(work){assert.equal(path.dirname(fs.realpathSync(work)),fs.realpathSync(parent));fs.rmSync(work,{recursive:true,force:true});}
});

test('Hugo generates real WebP candidates, caps without upscaling and reuses cached variants',async t=>{
  const normal=images(output),limited=images(capped);assert.equal(normal.length,4);
  const engine=loadChromium(),browser=await engine.launch({executablePath:engine.executablePath(),headless:true});
  try {
    const page=await browser.newPage();await page.goto(server.getBaseUrl());
    for(const [index,[name,width,height,expected]] of pictures.entries()) {
      const image=normal[index];assert.deepEqual(image.candidates.map(item=>item.width),expected);
      assert.deepEqual([image.width,image.height],[width,height]);assert.equal(image.sizes,'auto');assert.equal(image.sourceSizes,sizes);
      assert.equal(image.href,image.src,'Click-through opens the original image.');
      assert.deepEqual(fs.readFileSync(path.join(output,image.href)),fs.readFileSync(path.join(source,'content/images',name+'.png')));
      for(const candidate of image.candidates) {
        const dimensions=await page.evaluate(async url=>{
          const response=await fetch(url);if(!response.ok)throw new Error('Candidate download failed.');
          const bitmap=await createImageBitmap(await response.blob()),size=[bitmap.width,bitmap.height];bitmap.close();return size;
        },candidate.url);
        assert.deepEqual(dimensions,[candidate.width,Math.round(height*candidate.width/width)],'WebP pixels match the declared candidate.');
      }
      assert.deepEqual(limited[index].candidates.map(item=>item.width),expected.filter(value=>value<1000).concat(width>=1000?[1000]:[]));
    }
    assert.deepEqual(normal[3].candidates,normal[0].candidates,'Repeated Markdown images reuse generated URLs.');
    assert.equal(normal[3].href,normal[0].href);
  } finally {await browser.close();}
  t.diagnostic('Hugo wall time (ms), 3 images / 6 unique variants: '+JSON.stringify(timings));
});

for(const loadBrowser of [loadChromium,loadWebkit])test(loadBrowser.name+' selects downloaded WebP candidates using viewport, DPR and actual image width',async t=>{
  const engine=loadBrowser(),browser=await engine.launch({executablePath:engine.executablePath(),headless:true}),image=images(output)[0];
  try {
    for(const [width,dpr,narrow,withoutAuto] of [[390,1],[390,2],[390,3],[1440,1],[1440,2],[1440,3],[1440,2,true],[1440,2,true,true]]) {
      const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:dpr,serviceWorkers:'block'});
      try {
        const page=await context.newPage(),requests=[];page.on('request',request=>{if(request.resourceType()==='image')requests.push(new URL(request.url()).pathname);});
        if(narrow)await page.route('**/*.css',async route=>{
          const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\n.prose{--prose-max-inline:300px}'});
        });
        if(narrow)await page.route('**/images/',async route=>{
          const response=await route.fetch(),html=await response.text();assert.ok(html.includes(sizes));
          let body=html.replaceAll(sizes,'auto, 3000px');
          if(withoutAuto)body=body.replaceAll('auto, 3000px','3000px').replace(/(<img\b[^>]*?)\s+sizes=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'$1');
          await route.fulfill({response,body});
        });
        await page.goto(server.getBaseUrl()+route,{waitUntil:'load'});
        const locator=page.locator('.md-responsive-image img').first();await locator.scrollIntoViewIfNeeded();await locator.evaluate(node=>node.decode());
        const state=await locator.evaluate(node=>{
          const width=node.getBoundingClientRect().width,style=getComputedStyle(node);
          const frame=['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'].reduce((sum,name)=>sum+parseFloat(style[name]),0);
          return {src:new URL(node.currentSrc).pathname,width,contentWidth:width-frame,pixels:devicePixelRatio,sizes:node.sizes};
        });
        const selected=image.candidates.find(candidate=>candidate.url===state.src);assert.ok(selected,'The browser uses a generated WebP.');
        assert.ok(requests.includes(state.src),'The selected candidate was downloaded.');
        assert.ok(!requests.includes(image.src),'Loading the article does not download the original PNG.');
        const desired=state.contentWidth*state.pixels,expected=image.candidates.find(candidate=>candidate.width>=desired)?.width??1600;
        if(narrow){assert.ok(state.width<=300,'The regression fixture constrains the image.');assert.equal(expected,768);}
        if(withoutAuto) {
          assert.equal(state.sizes,'','The fallback fixture removes automatic sizing.');
          assert.equal(selected.width,1600,'Without auto sizing, the oversized fallback selects the largest candidate.');
        } else {
          assert.equal(state.sizes,'auto','The img enables automatic sizing.');
          assert.equal(selected.width,expected,'The browser selects from the actual rendered image width.');
        }
        t.diagnostic(`${browser.browserType().name()} ${browser.version()}: viewport ${width}, DPR ${dpr}, rendered ${state.width.toFixed(1)}, candidate ${selected.width}${narrow?', narrow CSS, 3000px fallback':''}${withoutAuto?', auto sizing removed':''}`);
      } finally {await context.close();}
    }
  } finally {await browser.close();}
},{timeout:120000});
