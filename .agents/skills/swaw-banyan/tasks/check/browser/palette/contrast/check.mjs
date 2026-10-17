import assert from 'node:assert/strict';
import {openProse} from '../page.mjs';
import {setTheme} from '../../_shared/theme.mjs';

export async function check({page,baseUrl,options}) {
  await openProse(page,baseUrl,options.page);
  const outcomes = [];
  await page.evaluate(() => {
      const tokens = '<span class="n" data-contrast="plain">value </span>'
          + '<span class="k" data-contrast="keyword">return </span>'
          + '<span class="s" data-contrast="string">"text" </span>'
          + '<span class="c" data-contrast="comment">// comment </span>'
          + '<span class="kt" data-contrast="type">Type </span>'
          + '<span class="ln" data-contrast="line-number">1</span>';
      const fixture = document.createElement('div');
      fixture.id = 'contrast-fixture';
      // Root pages do not naturally exercise every syntax class or highlighted line.
      fixture.innerHTML = `
          <p><del data-contrast="deleted">Deleted text</del> <s data-contrast="deleted">Old text</s></p>
          <blockquote><p><del data-contrast="deleted">Deleted quote</del></p></blockquote>
          <table><thead><tr><th><del data-contrast="deleted">Old header</del></th></tr></thead>
              <tbody><tr><td>First row</td></tr><tr><td><del data-contrast="deleted">Old row</del></td></tr></tbody></table>
          <div class="highlight"><pre class="chroma"><code><span class="line">${tokens}</span><span class="line hl">${tokens}</span></code></pre></div>`;
      document.querySelector('.prose').append(fixture);
  });

  for (const mode of ['light', 'dark']) {
      await setTheme(page,mode);
      const measurements = await page.evaluate(() => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          const paint = color => {
              context.fillStyle = color;
              context.fillRect(0, 0, 1, 1);
          };
          const luminance = () => [...context.getImageData(0, 0, 1, 1).data].slice(0, 3)
              .map(value => value / 255)
              .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
              .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
          return [...document.querySelectorAll('#contrast-fixture [data-contrast]')].map(element => {
              const ancestors = [];
              for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
              paint('white');
              for (const node of ancestors) {
                  const style = getComputedStyle(node);
                  if (style.backgroundImage !== 'none' || style.opacity !== '1') {
                      throw new Error('Contrast fixture requires solid backgrounds and unmodified opacity.');
                  }
                  // Canvas resolves color-mix and composites transparent ancestors.
                  paint(style.backgroundColor);
              }
              const background = luminance();
              paint(getComputedStyle(element).color);
              const foreground = luminance();
              return {
                  role: element.dataset.contrast,
                  highlighted: !!element.closest('.hl'),
                  ratio: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05)
              };
          });
      });
      outcomes.push({mode,measurements});
      assert.equal(measurements.length, 17, 'Exercise all text roles and both code backgrounds.');
      for (const { role, highlighted, ratio } of measurements) {
          const minimum = options.min;
          assert(ratio >= minimum, `${mode}: ${role}${highlighted ? ' on highlighted line' : ''} is ${ratio.toFixed(3)}:1; needs ${minimum}:1.`);
      }
  }
  return {page:options.page,minimum:options.min,modes:outcomes};
}
