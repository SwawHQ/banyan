import assert from 'node:assert/strict';
import {readColumns,columnSort} from '../../breadcrumb/_shared/page.mjs';

export const readLanguageHome=page=>page.locator('[data-root-navigation] [data-root-href]').evaluateAll(nodes=>{
  const paths=[...new Set(nodes.map(node=>new URL(node.dataset.rootHref,location.href))
    .filter(url=>url.origin===location.origin).map(url=>url.pathname))];
  return paths.find(path=>paths.every(other=>other.startsWith(path)))||'';
});

export async function assertRootLinks(page) {
  const columns=await readColumns(page);
  const links=await page.locator('[data-root-href]').evaluateAll(nodes=>nodes.map(node=>({
    tag:node.tagName,href:node.href,root:node.dataset.rootHref,target:node.getAttribute('target'),download:node.hasAttribute('download')
  })));
  assert.ok(links.length,'Root navigation checks need native links.');
  for(const link of links) {
    const href=new URL(link.href),root=new URL(link.root,page.url());
    assert.equal(link.tag,'A','Root entries must remain native links.');
    assert.equal(root.origin,new URL(page.url()).origin,'Root paths must stay on the local site.');
    assert.equal(root.search+root.hash,'','Root entries must not carry return context.');
    const column=columns.find(column=>column.href&&new URL(column.href,page.url()).href===root.href);
    if(column?.toggle) {
      const token=columnSort(column);
      if(token!==column.source.defaultSort)root.hash='sorts='+token;
    }
    assert.equal(href.href,root.href,'Root links must retain their ordinary URLs or the expanded column sort.');
    assert.ok(!link.target||link.target==='_self','Root links must use the current tab by default.');
    assert.equal(link.download,false,'Root entries must navigate, not download.');
  }
  return links.length;
}
