import assert from 'node:assert/strict';
import {openProse} from '../page.mjs';
import {setTheme} from '../../../../_shared/browser/theme.mjs';

export async function check({page,baseUrl,options}) {
  await openProse(page,baseUrl,options.page);
  const outcomes = [];
  // Exercise the published component CSS together, independent of article content.
  await page.evaluate(() => {
      const fixture = document.createElement('div');
      fixture.id = 'palette-fixture';
      fixture.innerHTML = `
          <p><code data-palette="inline">Inline code</code></p>
          <table><thead><tr><th data-palette="header">Header</th></tr></thead>
              <tbody><tr><td>First row</td></tr>
              <tr data-palette="stripe"><td>Second row</td></tr></tbody></table>
          <div class="highlight" data-palette="block"><pre class="chroma"><code><span class="line hl" data-palette="highlight">Highlighted code</span></code></pre></div>
          <img data-palette="image" alt="" width="1" height="1">
          <hr data-palette="rule">`;
      document.querySelector('.prose').append(fixture);
  });

  const readColors = () => page.evaluate(() => {
      const style = name => getComputedStyle(document.querySelector(
          `#palette-fixture [data-palette="${name}"]`
      ));
      return {
          inlineBg: style('inline').backgroundColor,
          inlineBorder: style('inline').borderTopColor,
          headerBg: style('header').backgroundColor,
          tableBorder: style('header').borderTopColor,
          stripeBg: style('stripe').backgroundColor,
          blockBg: style('block').backgroundColor,
          blockBorder: style('block').borderTopColor,
          highlightBg: style('highlight').backgroundColor,
          imageBg: style('image').backgroundColor,
          imageBorder: style('image').borderTopColor,
          ruleBorder: style('rule').borderTopColor
      };
  });

  for (const mode of ['light', 'dark']) {
      await setTheme(page,mode);
      const baseline = await readColors();
      outcomes.push({mode,baseline});

      await page.evaluate(theme => {
          document.documentElement.style.setProperty('--fg', theme === 'light' ? '#12324a' : '#bed5e6');
      }, mode);
      const changedForeground = await readColors();
      const foregroundDependent = [
          'inlineBorder', 'tableBorder', 'blockBg', 'blockBorder',
          'highlightBg', 'imageBorder', 'ruleBorder',
          ...(mode === 'light' ? ['headerBg', 'stripeBg'] : [])
      ];
      for (const role of foregroundDependent) {
          assert.notEqual(changedForeground[role], baseline[role], `${mode}: ${role} follows the foreground input.`);
      }

      await page.evaluate(theme => {
          document.documentElement.style.setProperty('--bg', theme === 'light' ? '#e5eaf0' : '#15293a');
      }, mode);
      const changedBackground = await readColors();
      for (const role of Object.keys(baseline)) {
          assert.notEqual(changedBackground[role], changedForeground[role], `${mode}: ${role} follows the background input.`);
      }
      await page.evaluate(() => {
          document.documentElement.style.removeProperty('--fg');
          document.documentElement.style.removeProperty('--bg');
      });
      assert.deepEqual(await readColors(), baseline, `${mode}: removing palette overrides restores all defaults.`);

      await page.evaluate(() => {
          document.querySelector('.prose').style.setProperty('--prose-border-neutral', '#47a0b3');
      });
      const changedBorder = await readColors();
      for (const role of Object.keys(baseline)) {
          if (['inlineBorder', 'tableBorder', 'imageBorder'].includes(role)) {
              assert.notEqual(changedBorder[role], baseline[role], `${mode}: ${role} uses the shared neutral border.`);
          } else {
              assert.equal(changedBorder[role], baseline[role], `${mode}: ${role} remains independent of the shared neutral border.`);
          }
      }
      await page.evaluate(() => document.querySelector('.prose').style.removeProperty('--prose-border-neutral'));
      assert.deepEqual(await readColors(), baseline);

      // A root declaration cannot replace a role declared on .prose; edit its own scope.
      await page.evaluate(() => document.documentElement.style.setProperty('--table-header-bg', '#31547a'));
      assert.deepEqual(await readColors(), baseline, `${mode}: prose roles retain their local scope.`);
      await page.evaluate(() => document.querySelector('.prose').style.setProperty('--table-header-bg', '#31547a'));
      assert.deepEqual(await readColors(), {
          ...baseline,
          headerBg: 'rgb(49, 84, 122)'
      }, `${mode}: a literal role override changes only its own surface.`);
      await page.evaluate(() => {
          document.querySelector('.prose').style.removeProperty('--table-header-bg');
          document.documentElement.style.removeProperty('--table-header-bg');
      });
      assert.deepEqual(await readColors(), baseline, `${mode}: a literal role can return to its derived default.`);
  }

  return {page:options.page,modes:outcomes};
}
