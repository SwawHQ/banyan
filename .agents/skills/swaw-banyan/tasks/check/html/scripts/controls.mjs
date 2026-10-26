import assert from 'node:assert/strict';
import {extractBlocks,stripRawText} from '../../../_shared/html/blocks.mjs';
import {extractExternalScriptSrcs,extractStartTags,extractTagAttribute as attr,hasClassToken} from '../../../_shared/html/markup.mjs';

const has=(tag,name)=>new RegExp('\\sdata-'+name+'(?=\\s|=|/?>)','i').test(tag);

export function inspectDocumentControls(html) {
  try {
    const source=stripRawText(html),buttons=extractStartTags(source,'button');
    const aside=extractBlocks(source,'aside',tag=>attr(tag,'id')==='document-aside');
    const toc=extractBlocks(source,'nav',tag=>hasClassToken(tag,'document-toc'));
    const toggle=buttons.filter(tag=>attr(tag,'id')==='document-aside-toggle');
    const close=buttons.filter(tag=>attr(tag,'id')==='document-aside-close');
    assert.ok(toc.length<=1,'Chapter list must occur at most once.');
    assert.equal(aside.length,hasClassToken(source,'document-meta')||toc.length?1:0,'Aside follows metadata or chapter content.');
    const collapsible=toggle.length>0||close.length>0;
    assert.equal(toggle.length,collapsible?1:0,'Aside toggle must pair with one close button.');
    assert.equal(close.length,collapsible?1:0,'Aside close button must pair with one toggle.');
    for(const button of [...toggle,...close]) {
      assert.equal(attr(button,'type'),'button','Aside controls use native buttons.');
      assert.equal(attr(button,'aria-controls'),'document-aside','Aside controls reference the aside.');
      assert.equal(aside.length,1,'Aside controls require aside content.');
    }
    if(toc.length)assert.ok(aside[0].inner.includes(toc[0].html),'Chapter list belongs to the aside.');
    const scripts=extractExternalScriptSrcs(source);
    for(const [family,expected] of [['aside',collapsible],['toc',toc.length>0]]) {
      const count=scripts.filter(ref=>new RegExp('/js/document/'+family+'(?:\\.min)?\\.[^/]+\\.js$').test(ref)).length;
      assert.equal(count,expected?1:0,'Document '+family+' controller follows its rendered controls.');
    }
    const panels=extractBlocks(source,'div',tag=>has(tag,'site-update-panel'));
    assert.ok(panels.length<=1,'Update panel must occur at most once.');
    for(const panel of panels) {
      const status=extractStartTags(panel.inner,'p').filter(tag=>has(tag,'site-update-status'));
      assert.equal(status.length,1,'Update panel has one live status.');
      assert.equal(attr(status[0],'role'),'status','Update status exposes its role.');
      assert.equal(attr(status[0],'aria-live'),'polite','Update status uses polite announcements.');
      const actions=extractBlocks(panel.inner,'button',tag=>has(tag,'site-update-action'));
      assert.ok(actions.length<=1,'Update panel has at most one action.');
      for(const action of actions) {
        assert.equal(attr(action.open,'type'),'button','Update action uses a native button.');
        assert.equal(attr(action.open,'data-site-update-action'),'check','Update action checks for updates.');
        assert.equal(extractStartTags(action.inner,'span').filter(tag=>has(tag,'site-update-action-label')).length,1,'Update action has one label.');
      }
      assert.equal(extractStartTags(panel.inner,'time').length,0,'Build time stays outside the update panel.');
    }
    return [];
  } catch(error) {return [error.message];}
}
