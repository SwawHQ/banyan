import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';

async function rendered(page,expected) {
  await waitForBrowse(page);await afterPaint(page);
  assert.equal(page.url(),expected,'Panel navigation must retain the requested URL.');
  const panel=page.locator('[data-site-update-panel]');
  assert.equal(await panel.count(),1,'The page must contain one update panel.');
  assert.ok(await panel.isVisible(),'The update panel must be visible.');
  await page.waitForFunction(()=>Boolean(document.querySelector('[data-site-update-panel]')?.dataset.siteUpdateState));
  await panel.scrollIntoViewIfNeeded();
  const value=await panel.evaluate(node=>{
    const copy=JSON.parse(node.dataset.siteUpdateCopy);
    const status=node.querySelector('[data-site-update-status]'),action=node.querySelector('[data-site-update-action="check"]');
    return {state:node.dataset.siteUpdateState,copy,controlled:node.querySelector('[data-pwa-controlled]')?.textContent,
      hasController:Boolean(navigator.serviceWorker?.controller),status:status?.textContent,role:status?.getAttribute('role'),live:status?.getAttribute('aria-live'),
      action:action?{tag:action.tagName,type:action.getAttribute('type'),pressed:action.getAttribute('aria-pressed'),disabled:action.disabled,label:action.querySelector('[data-site-update-action-label]')?.textContent}:null};
  });
  const {state,copy,action}=value;
  for(const name of ['yes','no','status','unavailable'])assert.ok(typeof copy[name]==='string'&&copy[name].trim(),'Panel labels must contain '+name+'.');
  assert.equal(value.controlled,copy[value.hasController?'yes':'no'],'Panel control status must use the current runtime and locale.');
  if(!action)assert.equal(state,'unavailable','A panel without a check button must show unavailable.');
  assert.equal(value.role,'status','Panel status must have an accessible status role.');
  assert.equal(value.live,'polite','Panel status must announce changes politely.');
  if(state==='idle')assert.equal(value.status,'','Idle panels must have no status message.');
  else {
    assert.ok(value.status?.startsWith(copy.status+': '),'Panel status must use its localized label.');
    const field={unavailable:'unavailable',checking:'checking',installing:'installing',failed:'check_failed',offline:'status_offline',ready:'status_ready',current:'status_current'}[state];
    assert.ok(field&&typeof copy[field]==='string'&&copy[field].trim(),'Panel state must have a localized message.');
    assert.ok(value.status.includes(copy[field]),'Panel status must contain the current localized message.');
  }
  if(action) {
    assert.equal(action.tag,'BUTTON','The update check must be a native button.');
    assert.equal(action.type,'button','The update check must not submit a form.');
    assert.equal(action.pressed,null,'The update check must not expose a pressed state.');
    assert.equal(action.disabled,['checking','installing','unavailable'].includes(state),'The check button must reflect whether checking is available.');
    const label=copy[state==='checking'?'checking':'check'];
    assert.ok(typeof label==='string'&&label.trim(),'The check button must have a localized label.');
    assert.equal(action.label,label,'The check button must use the current localized label.');
    assert.equal(await panel.getByRole('button',{name:label,exact:true}).count(),1,'The check button must expose its localized accessible name.');
  }
  return {state,controlled:value.controlled,action:Boolean(action)};
}

export async function check({page,baseUrl,options}) {
  const expected=new URL(options.page,baseUrl).href,from=new URL(options.from,baseUrl).href,cases=[],errors=[];
  assert.notEqual(expected,from,'The panel and linked page must differ.');
  const onError=error=>errors.push(error.message);page.on('pageerror',onError);
  try {
    for(const width of options.widths.split(',').map(Number)) {
      await page.setViewportSize({width,height:844});
      const response=await page.goto(expected,{waitUntil:'load'});
      assert.ok(response?.ok(),'Panel checks need a successful page response.');
      cases.push({width,phase:'visit',...await rendered(page,expected)});
      await page.reload({waitUntil:'load'});
      cases.push({width,phase:'reload',...await rendered(page,expected)});
      const away=page.locator('[data-root-href]');
      // Select the caller's native root link by its full resolved destination.
      const index=await away.evaluateAll((nodes,href)=>nodes.findIndex(node=>node.href===href),from);
      assert.ok(index>=0,'The panel page must link to --from through a root entry.');
      await away.nth(index).click();await page.waitForURL(from,{waitUntil:'load'});
      await page.goBack({waitUntil:'load'});
      cases.push({width,phase:'back',...await rendered(page,expected)});
      await page.goto(from,{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
      const roots=page.locator('[data-root-href]'),target=await roots.evaluateAll((nodes,href)=>nodes.findIndex(node=>node.href===href),expected);
      assert.ok(target>=0,'The linked page must have a native root entry for the panel.');
      await roots.nth(target).click();await page.waitForURL(expected,{waitUntil:'load'});
      cases.push({width,phase:'entry',...await rendered(page,expected)});
    }
    assert.deepEqual(errors,[],'Panel rendering must not raise uncaught errors.');
    return {page:options.page,from:options.from,cases};
  }finally{page.off('pageerror',onError);}
}
