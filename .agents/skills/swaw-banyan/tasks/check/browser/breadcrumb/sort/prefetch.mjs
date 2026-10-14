import assert from 'node:assert/strict';

export async function checkPrefetchSelectors(page) {
  const state=await page.locator('[data-slot=breadcrumb]').evaluate(node=>{
    const entries=[...node.querySelectorAll('[data-list-entry][href]')],anchors=[...node.querySelectorAll('a[href]')];
    const payload=document.getElementById('site-prefetch-rules'),rules=payload?JSON.parse(payload.textContent):null;
    const current=new URL(location.href);current.hash='';
    const invalid=anchors.filter(link=>{
      if(link.hasAttribute('data-prefetch-slot'))return true;
      if(!rules)return false;
      const url=new URL(link.href);url.hash='';
      if(url.origin!==location.origin||!/(?:\/|\.html?)$/i.test(url.pathname)||url.href===current.href||
        link.hasAttribute('download')||(link.target&&link.target.toLowerCase()!=='_self'))return false;
      return rules.prefetch.filter(rule=>link.matches(rule.selector)).length!==1;
    }).map(link=>({href:link.getAttribute('href')}));
    return {entries:entries.length,anchors:anchors.length,
      invalid};
  });
  assert.ok(state.entries>0,'Breadcrumb prefetch checks need rendered collection entries.');
  assert.deepEqual(state.invalid,[],'Runtime breadcrumb anchors must use shared selectors without slot markers.');
  return state;
}
