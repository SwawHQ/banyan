import assert from 'node:assert/strict';
import {waiting} from '../_shared/state.mjs';
import {builds,visit,update,rootLink,version,observe,quiet,settled} from '../_shared/update.mjs';

export async function check({page,context=page.context(),server,baseUrl,options}) {
  const pair=await builds(options),target=new URL(options.page,baseUrl).href,from=new URL(options.from,baseUrl).href;
  assert.notEqual(from,target,'Native history checks need two pages.');
  const events=observe(page);let popup;
  try {
    await server.setRoot(pair.old);await visit(page,from,options.timeout);await visit(page,target,options.timeout);
    const before=await version(page);await server.setRoot(pair.next);await update(page,options.timeout);
    events.loads=0;await page.reload({waitUntil:'load'});await settled(page);
    assert.equal(events.loads,1,'Refresh must not trigger an extra application reload.');
    assert.equal(await version(page),before,'Refresh must keep the active build while its update waits.');
    await waiting(page,options.timeout);
    await page.goBack({waitUntil:'load'});assert.equal(page.url(),from);await waiting(page,options.timeout);
    await page.goForward({waitUntil:'load'});assert.equal(page.url(),target);await waiting(page,options.timeout);
    await page.evaluate(()=>{
      const anchor=document.createElement('a');anchor.id='swban-native-anchor';anchor.href='#main';anchor.textContent='Anchor';document.body.prepend(anchor);
    });
    await page.locator('#swban-native-anchor').click();await waiting(page,options.timeout);
    assert.equal(new URL(page.url()).hash,'#main','Native anchors must keep their fragment.');
    const current=page.url();
    for(const input of [{button:'middle'},{modifiers:[process.platform==='darwin'?'Meta':'Control']}]) {
      const tabs=context.waitForEvent('page');
      // Use a different document: a current-page link could pass merely because
      // the runtime already ignores same-document navigation.
      await (await rootLink(page,from)).click(input);popup=await tabs;
      // The tab event can arrive at about:blank before the destination loads.
      await popup.waitForURL(from,{waitUntil:'load'});await waiting(popup,options.timeout);await waiting(page,options.timeout);
      assert.equal(page.url(),current,'A native new tab must preserve its source.');
      assert.equal(await version(page),before,'New tabs must not activate the waiting worker.');
      await popup.close();popup=null;
    }
    quiet(events);
    return {page:options.page,from:options.from,version:before,refreshLoads:1,waitingAfter:['refresh','back','forward','anchor','new-tab']};
  }finally{events.stop();if(popup)await popup.close();}
}
