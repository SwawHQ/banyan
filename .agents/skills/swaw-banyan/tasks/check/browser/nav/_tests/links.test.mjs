import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readLanguageHome} from '../_shared/links.mjs';

test('language home uses root paths rather than order, query or fragment',async()=>{
  const previous=globalThis.location;
  globalThis.location=new URL('https://example.test/base/zh/p/article/');
  try {
    for(const [hrefs,expected] of [
      [['/articles-all/','/articles/','/'],'/'],
      [['/base/zh/articles-all/','/base/zh/appearance/','/base/zh/?cached','/base/zh/#duplicate',
        'https://other.test/base/zh/'],'/base/zh/'],
      [['/zh/one/','/zh/two/'],''],
    ]) {
      const page={locator:()=>({evaluateAll:read=>read(hrefs.map(href=>({dataset:{rootHref:href}})))})};
      assert.equal(await readLanguageHome(page),expected);
    }
  } finally {
    if(previous===undefined)delete globalThis.location;
    else globalThis.location=previous;
  }
});
