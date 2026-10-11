import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';

const returnKeys=['banyan:language-return','banyan:language-return-label'];

export async function checkExplicitVisits(page,targets,languages,timeout=15000) {
  const cases=[];
  for(const {url,language} of targets) {
    const locale=language.split('-')[0].toLowerCase()==='en'?'zh-CN':'en-US';
    const context=await page.context().browser().newContext({locale,serviceWorkers:'block',viewport:page.viewportSize()});
    context.setDefaultTimeout(timeout);context.setDefaultNavigationTimeout(timeout);
    try {
      const visit=await context.newPage(),dialogs=[],requests=[];
      visit.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});
      visit.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===visit.mainFrame())requests.push(request.url());});
      await visit.addInitScript(()=>{
        window.__swbanLanguageVisit={shown:false};
        addEventListener('pageshow',()=>{window.__swbanLanguageVisit.shown=true;});
      });
      const phases=[];
      const pending=languages.find(code=>code!==language);
      assert.ok(pending,'Explicit language checks need another declared language.');
      for(const phase of ['visit','reload','pending-visit','pending-reload']) {
        if(phase.startsWith('pending-'))await visit.evaluate(({keys,code})=>{
          sessionStorage.setItem(keys[0],code);
          sessionStorage.setItem(keys[1],JSON.stringify({code,name:code}));
        },{keys:returnKeys,code:pending});
        // A same-fragment URL can reuse the current document; leave it before a new visit.
        if(phase==='pending-visit')await visit.goto('about:blank',{waitUntil:'load'});
        const reload=phase.endsWith('reload'),length=await visit.evaluate(()=>history.length);
        requests.length=0;
        const response=reload?await visit.reload({waitUntil:'load'}):await visit.goto(url,{waitUntil:'load'});
        assert.ok(response?.ok(),'Explicit language visits must return a successful response.');
        await visit.waitForFunction(()=>window.__swbanLanguageVisit?.shown);
        await waitForBrowse(visit);await afterPaint(visit);
        assert.equal(visit.url(),url,'Explicit visits and reloads must keep their URL language, query and fragment.');
        assert.equal(await visit.locator('html').getAttribute('lang'),language,'Explicit visits must keep the declared page language.');
        assert.deepEqual(dialogs,[],'Explicit language visits must not prompt.');
        assert.deepEqual(requests,[url.split('#')[0]],'Explicit visits must not request an automatic language redirect.');
        assert.deepEqual(await visit.evaluate(keys=>keys.map(key=>sessionStorage.getItem(key)),returnKeys),[null,null],
          'Explicit visits must consume pending language return state without translating.');
        if(reload)assert.equal(await visit.evaluate(()=>history.length),length,'Reloads must keep the history length.');
        phases.push({phase,navigation:await visit.evaluate(()=>performance.getEntriesByType('navigation')[0]?.type)});
      }
      const target=new URL(url);
      cases.push({page:target.pathname+target.search+target.hash,language,locale,phases});
    } finally {await context.close();}
  }
  return cases;
}
