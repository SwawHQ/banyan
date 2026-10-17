import assert from 'node:assert/strict';
import {setTheme} from '../../_shared/theme.mjs';
import {tableSamples,checkTableStyles} from './tables.mjs';

export async function check({page,baseUrl,options}) {
  await page.emulateMedia({reducedMotion:'reduce'});
  const response = await page.goto(baseUrl+options.page,{waitUntil:'load'});
  assert.ok(response?.ok(),'Prose page must return a successful response.');
  assert.equal(await page.locator('.prose').count(),1,'The page must have one prose container.');
  const results = [];
  await page.evaluate(tables => {
      const prose = document.querySelector('.prose');
      prose.innerHTML = '<p><a id="test-link" href="#probe">Readable link text</a></p><ul><li>Ordinary words stay together in a paragraph.</li></ul><p id="test-long"><a href="#probe">https://example.invalid/' + 'longsegment'.repeat(25) + '</a></p>'+tables+'<blockquote><p>Last quote keeps its top spacing.</p></blockquote>';
      prose.style.inlineSize = '230px';
  },tableSamples);
  for (const theme of ['light', 'dark']) {
      await setTheme(page,theme);
      await page.locator('#test-link').hover();
      const style = await page.evaluate(() => {
          const prose = document.querySelector('.prose');
          const link = getComputedStyle(document.querySelector('#test-link'));
          const listItem = getComputedStyle(prose.querySelector('li'));
          const quote = getComputedStyle(prose.querySelector('blockquote'));
          const longLink = document.querySelector('#test-long');
          return { opacity: link.opacity, wordBreak: listItem.wordBreak, display: listItem.display,
              quoteTop: parseFloat(quote.marginBlockStart), quoteBottom: parseFloat(quote.marginBlockEnd),
              longLinkFits: longLink.scrollWidth <= longLink.clientWidth + 1 };
      });
      results.push({theme,...style,tables:await checkTableStyles(page)});
      assert.equal(style.opacity, '1','Hover must keep full link opacity.');
      assert.equal(style.wordBreak, 'normal','List items must retain natural word wrapping.');
      assert.equal(style.display, 'list-item','List items must keep their native display.');
      assert(style.quoteTop > 0,'The final quote must retain its top spacing.');
      assert.equal(style.quoteBottom, 0,'The final quote must have no trailing spacing.');
      assert(style.longLinkFits,'Long URLs must fit the prose column.');
  }
  return {page:options.page,width:230,themes:results};
}
