import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadChromium} from '../../../_shared/browser/runtime.mjs';
import {startAuthPage} from '../page.mjs';
const document = JSON.parse(fs.readFileSync(new URL('../page.json',import.meta.url),'utf8'));

for (const language of ['zh','en']) test('Shared authorization page '+language+' supports two platforms and three methods',{timeout:30000},async()=>{
  const text = document[language],cfText = {...text,...text.cloudflare},tcText = {...text,...text.tencent};
  const writes = [],errors = [],logins = [],preparations = [];
  const parent = fs.realpathSync.native(os.tmpdir()),siteRoot = fs.mkdtempSync(path.join(parent,'swban-auth-browser-'));
  fs.mkdirSync(path.join(siteRoot,'static'));
  fs.writeFileSync(path.join(siteRoot,'static/favicon.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="green"/></svg>');
  let local,browser;
  try {
    const platform = language === 'zh' ? 'cloudflare' : 'tencent';
    local = await startAuthPage({platform,siteRoot,language,environment:{CLOUDFLARE_API_TOKEN:'private-fixture-token',CLOUDFLARE_ACCOUNT_ID:'b'.repeat(32),
      TENCENTCLOUD_SECRET_ID:'private-id',TENCENTCLOUD_SECRET_KEY:'private-key',TENCENTCLOUD_TOKEN:'private-sts-token'},login:async tool=>{
      logins.push(tool);if(logins.filter(value=>value===tool).length===1 && tool!=='cf')throw new Error('private-error');
    },prepare:async tool=>{preparations.push(tool);},store:async(platform,action,value)=>{
      if(action==='write')writes.push({platform,...value});return action==='check'&&platform==='cloudflare'?{userName:'api-token'}:null;
    },verify:async(platform,value)=>{if(value.token==='invalid-fixture-token')throw new Error('cloudflare_token_verification_failed');}});
    const chromium = loadChromium();
    browser = await chromium.launch({headless:true,executablePath:chromium.executablePath()});
    const context = await browser.newContext({viewport:{width:480,height:800},locale:language==='zh'?'en-US':'zh-CN',colorScheme:language==='zh'?'light':'dark'});
    const page = await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(local.url);await page.getByRole('heading',{level:1,name:text.title,exact:true}).waitFor();
    await page.locator('#'+(platform==='tencent'?'tccli':'cf')+'-status').filter({hasText:text.ready}).waitFor();
    assert.deepEqual(logins,[]);assert.equal(preparations.includes('tccli'),platform==='tencent');
    assert.equal(await page.title(),text.title);assert.equal(await page.locator('html').getAttribute('lang'),language);
    assert.deepEqual(await page.locator('#platforms').getByRole('tab').allTextContents(),[text.cloudflareName,text.tencentName]);
    assert.equal(await page.locator('#tab-'+platform).getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('#platforms').getAttribute('aria-orientation'),'horizontal');
    await page.setViewportSize({width:900,height:800});
    await page.waitForFunction(()=>document.querySelector('#platforms').getAttribute('aria-orientation')==='vertical');
    await page.locator('#tab-cloudflare').press('Home');
    await page.locator('#tab-cloudflare').press('ArrowDown');
    assert.equal(await page.locator('#tab-tencent').getAttribute('aria-selected'),'true');
    const navigation = await page.locator('#platforms').boundingBox(),content = await page.locator('#platform-tencent').boundingBox();
    assert.ok(navigation.x+navigation.width<content.x);
    const platformTab = await page.locator('#tab-cloudflare').boundingBox(),methodTab = await page.locator('#tencent-tab-login').boundingBox();
    assert.ok(Math.abs(platformTab.y-methodTab.y)<1,'Platform and method tabs must align');
    const heading = await page.locator('header').boundingBox(),priorityNote = await page.locator('[data-text="priority"]').boundingBox(),workspace = await page.locator('main').boundingBox();
    assert.ok(priorityNote.y>=heading.y+heading.height && priorityNote.y+priorityNote.height<workspace.y,'Priority must be below the title and above the panel');
    const closeButton = await page.locator('#close').boundingBox(),lastMethod = await page.locator('#tencent-tab-environment').boundingBox();
    assert.ok(closeButton.x>=lastMethod.x+lastMethod.width && Math.abs(closeButton.y-methodTab.y)<1,'Close must be in the upper-right corner beside the method tabs');
    await page.locator('#tab-tencent').press('ArrowUp');
    assert.equal(await page.locator('#tab-cloudflare').getAttribute('aria-selected'),'true');
    const before = await page.locator('#cloudflare-tab-token').boundingBox();
    await page.locator('#tab-tencent').click();
    const after = await page.locator('#tencent-tab-token').boundingBox();
    for(const key of ['x','y','width','height'])assert.ok(Math.abs(before[key]-after[key])<1,'API Token tab moved: '+key);
    assert.equal(await page.locator('#tencent-tab-token').textContent(),'API Token');
    await page.setViewportSize({width:480,height:800});
    await page.waitForFunction(()=>document.querySelector('#platforms').getAttribute('aria-orientation')==='horizontal');
    await page.locator('#tab-tencent').press('ArrowLeft');
    assert.equal(await page.locator('#tab-cloudflare').getAttribute('aria-selected'),'true');
    await page.locator('#tab-cloudflare').click();
    const cf = page.locator('#platform-cloudflare'),tc = page.locator('#platform-tencent');
    for(const [panel,copy] of [[cf,cfText],[tc,tcText]]) {
      assert.deepEqual(await panel.locator('[data-methods]').getByRole('tab',{includeHidden:true}).allTextContents(),[text.tabLogin,copy.tabToken,text.tabEnvironment]);
      const notes=panel.locator('[id$="-login"] footer');
      assert.deepEqual(await notes.locator('ol > li').allTextContents(),[copy.loginFlow,copy.loginPermissions,copy.loginStorage]);
      assert.equal(await notes.evaluate(element=>!!(element.parentElement.querySelector('.login-action').compareDocumentPosition(element)&Node.DOCUMENT_POSITION_FOLLOWING)),true);
    }
    const cfPriority = page.getByText(text.priority,{exact:true});
    assert.equal(await cfPriority.isVisible(),true);
    assert.equal(await page.locator('body > [data-text="priority"]').count(),1);
    const cfAction = await cf.locator('[data-tool="cf"]').boundingBox(),wranglerAction = await cf.locator('[data-tool="wrangler"]').boundingBox();
    assert.equal(cfAction.width,wranglerAction.width);
    await cf.getByRole('button',{name:cfText.loginCf,exact:true}).click();await page.locator('#cf-status').filter({hasText:text.authorized}).waitFor();
    for(let attempt=0;attempt<2;attempt++){
      await cf.getByRole('button',{name:cfText.loginWrangler,exact:true}).click();
      await page.locator('#wrangler-status').filter({hasText:attempt?text.authorized:text.errors.login_failed}).waitFor();
    }
    await cf.getByRole('tab',{name:text.tabEnvironment,exact:true}).click();
    assert.equal(await cfPriority.isVisible(),true);assert.equal(await cf.locator('#cloudflare-environment input').count(),0);
    assert.equal(await cf.locator('[data-env="token"]').textContent(),text.set);
    assert.equal(await cf.locator('[data-env="accountId"]').textContent(),'b'.repeat(32));
    await cf.getByRole('tab',{name:text.tabEnvironment,exact:true}).press('Home');
    assert.equal(await cf.getByRole('tab',{name:text.tabLogin,exact:true}).getAttribute('aria-selected'),'true');
    await cf.getByRole('tab',{name:text.tabLogin,exact:true}).press('ArrowRight');
    assert.equal(await cf.getByRole('tab',{name:cfText.tabToken,exact:true}).getAttribute('aria-selected'),'true');
    assert.equal(await cfPriority.isVisible(),true);
    for(const key of ['login','create','findAccount','user']){
      const link = cf.getByRole('link',{name:cfText[key],exact:true});
      assert.equal(await link.getAttribute('href'),document.links.cloudflare[key]);assert.equal(await link.getAttribute('target'),'_blank');
      assert.match(await link.getAttribute('rel'),/noopener/);
    }
    assert.equal(await cf.locator('#cloudflare-token > ol a[href="https://dash.cloudflare.com/profile/api-tokens"]').count(),0);
    assert.equal(await cf.locator('#cloudflare-token > ol > li').count(),3);
    const cfNotes=cf.locator('#cloudflare-token footer ol');
    assert.equal(await cfNotes.getAttribute('start'),'4');
    assert.deepEqual(await cfNotes.locator('li').allTextContents(),[cfText.userBefore+cfText.user+cfText.userAfter,cfText.storage,text.credential+'swban/cloudflare/default']);
    assert.equal(await cf.locator('#cloudflare-token > ol').evaluate(element=>!!(element.compareDocumentPosition(element.parentElement.querySelector('form')) & Node.DOCUMENT_POSITION_PRECEDING)),true);
    assert.equal(await page.locator('header img').evaluate(image=>image.complete&&image.naturalWidth>0),true);assert.equal(await page.locator('link[rel="icon"]').count(),1);
    assert.deepEqual([...new Set(await page.locator('body,h1,label,input,button,footer,code').evaluateAll(elements=>elements.map(element=>getComputedStyle(element).fontSize)))],['16px']);
    assert.equal(await page.locator('[data-text]:not([data-text="legacyHint"]):not([data-text="nativeHint"])').evaluateAll(elements=>elements.every(element=>element.textContent.trim())),true);
    const token = cf.locator('form').getByLabel(cfText.token,{exact:true});assert.equal(await token.getAttribute('type'),'password');
    await token.fill('invalid-fixture-token');await cf.getByRole('button',{name:text.replace,exact:true}).click();
    await cf.locator('[data-status]').filter({hasText:text.errors.cloudflare_token_verification_failed}).waitFor();assert.equal(writes.length,0);
    await token.fill('valid-fixture-token');await cf.getByLabel(cfText.account,{exact:true}).fill('a'.repeat(32));
    await cf.getByRole('button',{name:text.replace,exact:true}).click();await cf.locator('[data-status]').filter({hasText:text.saved}).waitFor();
    assert.deepEqual(writes,[{platform:'cloudflare',secret:'valid-fixture-token',userName:'a'.repeat(32)}]);assert.equal(await token.inputValue(),'');
    await page.locator('#tab-tencent').click();
    const priority = cfPriority;assert.equal(await priority.isVisible(),true);
    for(let attempt=0;attempt<2;attempt++){
      await tc.getByRole('button',{name:tcText.loginTccli,exact:true}).click();
      await page.locator('#tccli-status').filter({hasText:attempt?text.authorized:text.errors.login_failed}).waitFor();
    }
    assert.deepEqual(logins,['cf','wrangler','wrangler','tccli','tccli']);
    await tc.getByRole('tab',{name:tcText.tabToken,exact:true}).click();assert.equal(await priority.isVisible(),true);
    const tcNotes=tc.locator('#tencent-token footer ol');
    assert.equal(await tcNotes.getAttribute('start'),'4');
    assert.deepEqual(await tcNotes.locator('li').allTextContents(),[tcText.verification,tcText.storage,text.credential+'swban/tencent/default']);
    const secretId = 'AKID'+'c'.repeat(32),secretKey = 'd'.repeat(32);
    await tc.getByLabel(tcText.secretId,{exact:true}).fill(secretId);await tc.getByLabel(tcText.secretKey,{exact:true}).fill(secretKey);
    assert.equal(await tc.getByLabel(tcText.secretKey,{exact:true}).getAttribute('type'),'password');
    await tc.getByRole('button',{name:text.save,exact:true}).click();await tc.locator('[data-status]').filter({hasText:text.saved}).waitFor();
    assert.deepEqual(writes[1],{platform:'tencent',userName:secretId,secret:secretKey});assert.equal(await tc.getByLabel(tcText.secretKey,{exact:true}).inputValue(),'');
    await tc.getByRole('tab',{name:text.tabEnvironment,exact:true}).click();assert.equal(await priority.isVisible(),true);
    assert.equal(await tc.locator('#tencent-environment input').count(),0);assert.equal(await tc.locator('[data-env="TENCENTCLOUD_SECRET_KEY"]').textContent(),text.set);
    for(const secret of ['private-fixture-token','private-id','private-key','private-sts-token'])assert.ok(!(await page.locator('body').textContent()).includes(secret));
    await page.locator('#tab-tencent').press('Home');assert.equal(await page.locator('#tab-cloudflare').getAttribute('aria-selected'),'true');
    assert.equal(await cf.getByRole('tab',{name:cfText.tabToken,exact:true}).getAttribute('aria-selected'),'true');
    const other=language==='zh'?'en':'zh',otherText=document[other],switcher=page.locator('#language');
    await token.fill('unsaved-fixture-token');
    const callsBeforeSwitch=JSON.stringify({logins,preparations,writes}),urlBeforeSwitch=page.url();
    await switcher.selectOption(other);
    assert.equal(await page.locator('html').getAttribute('lang'),other);assert.equal(await page.title(),otherText.title);
    assert.equal(await switcher.getAttribute('aria-label'),otherText.language);
    assert.equal(await page.locator('#platforms').getAttribute('aria-label'),otherText.platforms);
    assert.equal(await cf.locator('[data-methods]').getAttribute('aria-label'),otherText.methods);
    assert.equal(await cf.locator('#cloudflare-tab-token').getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('#tab-cloudflare').getAttribute('aria-selected'),'true');
    assert.equal(await token.inputValue(),'unsaved-fixture-token');assert.equal(await cf.locator('#account').inputValue(),'a'.repeat(32));
    assert.equal(await cf.locator('[data-save]').textContent(),otherText.replace);assert.equal(await cf.locator('[data-status]').textContent(),otherText.saved);
    assert.equal(await page.locator('#cf-status').textContent(),otherText.authorized);
    assert.equal(await cf.locator('[data-env="token"]').textContent(),otherText.set);
    assert.equal(await cf.locator('[data-env="accountId"]').textContent(),'b'.repeat(32));
    assert.equal(JSON.stringify({logins,preparations,writes}),callsBeforeSwitch);assert.equal(page.url(),urlBeforeSwitch);
    await switcher.selectOption(language);assert.equal(await page.title(),text.title);assert.equal(await token.inputValue(),'unsaved-fixture-token');
    const missing = await context.newPage(),markup = '<img src=x onerror="window.injected=true">';
    await missing.route('**/page.json',async route=>{const response=await route.fetch(),data=await response.json();await route.fulfill({response,json:{...data,text:{...data.text,[language]:{...data.text[language],title:markup}}}});});
    await missing.goto(new URL(local.url).origin);await missing.locator('#page-status').filter({hasText:text.invalidSession}).waitFor();
    assert.equal(await missing.locator('h1').textContent(),markup);assert.equal(await missing.locator('h1 img').count(),0);assert.equal(await missing.locator('main').isVisible(),false);await missing.close();
    assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
    assert.deepEqual(await context.cookies(),[]);
    await switcher.selectOption(other);await page.reload();
    await page.getByRole('heading',{level:1,name:text.title,exact:true}).waitFor();
    assert.equal(await switcher.inputValue(),language);assert.equal(await page.locator('html').getAttribute('lang'),language);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
    await page.getByRole('button',{name:text.close,exact:true}).click();await page.locator('#page-status').filter({hasText:text.cancelled}).waitFor();assert.equal(await local.completed,'cancelled');
    await context.close();
  } finally {
    local?.close();await browser?.close();
    assert.equal(path.dirname(fs.realpathSync.native(siteRoot)),parent);assert.ok(path.basename(siteRoot).startsWith('swban-auth-browser-'));fs.rmSync(siteRoot,{recursive:true,force:true});
  }
});

for (const language of ['zh','en']) test('Sign-in preparation '+language+' starts early, leaves API Token usable and retries without signing in',{timeout:30000},async()=>{
  const text=document[language],calls=[],logins=[],errors=[],gate=Promise.withResolvers(),started=Promise.withResolvers();
  let local,browser;
  try {
    local=await startAuthPage({platform:'tencent',language,environment:{},store:async()=>null,verify:async()=>{},
      prepare:async tool=>{calls.push(tool);started.resolve();if(calls.length===1){await gate.promise;throw new Error('private-install-output');}},
      login:async tool=>{logins.push(tool);}});
    const chromium=loadChromium();browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
    const page=await browser.newPage({viewport:{width:360,height:800}});page.on('pageerror',error=>errors.push(error.message));
    await page.goto(local.url);await started.promise;
    const button=page.locator('[data-tool="tccli"]'),status=page.locator('#tccli-status');
    await status.filter({hasText:text.preparing}).waitFor();assert.equal(await button.isDisabled(),true);
    assert.equal(await button.getAttribute('aria-busy'),'true');assert.deepEqual(calls,['tccli']);assert.deepEqual(logins,[]);
    const other=language==='zh'?'en':'zh',switcher=page.locator('#language');
    await switcher.selectOption(other);assert.equal(await status.textContent(),document[other].preparing);
    assert.equal(await button.isDisabled(),true);assert.equal(await button.getAttribute('aria-busy'),'true');assert.deepEqual(calls,['tccli']);
    await switcher.selectOption(language);
    await page.locator('#tencent-tab-token').click();
    await page.locator('#secret-id').fill('AKID'+'a'.repeat(32));await page.locator('#secret-key').fill('b'.repeat(32));
    assert.equal(await page.locator('#platform-tencent [data-save]').isEnabled(),true);
    await page.locator('#platform-tencent [data-save]').click();await page.locator('#platform-tencent [data-status]').filter({hasText:text.saved}).waitFor();
    gate.resolve();await page.locator('#tencent-tab-login').click();
    await status.filter({hasText:text.errors.tool_preparation_failed}).waitFor();assert.equal(await button.textContent(),text.retryPrepare);
    await switcher.selectOption(other);
    assert.equal(await status.textContent(),document[other].errors.tool_preparation_failed);assert.equal(await button.textContent(),document[other].retryPrepare);
    await switcher.selectOption(language);
    assert.ok(!(await page.locator('body').textContent()).includes('private-install-output'));
    await button.click();await status.filter({hasText:text.ready}).waitFor();
    assert.equal(await button.textContent(),text.tencent.loginTccli);assert.equal(await button.getAttribute('aria-busy'),null);assert.deepEqual(logins,[]);
    await button.click();await status.filter({hasText:text.authorized}).waitFor();assert.deepEqual(logins,['tccli']);assert.deepEqual(calls,['tccli','tccli']);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  } finally {gate.resolve();local?.close();await browser?.close();}
});
