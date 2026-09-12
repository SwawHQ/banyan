import assert from 'node:assert/strict';
import { gotoAndWait } from './helpers.mjs';

export const paletteContractScenarios = [
    {
        id: 'palette-text-contrast',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Default Text Colors Stay Readable on Prose and Code Backgrounds',
        async run({ page, baseUrl }) {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await gotoAndWait(page, baseUrl + '/zh/about/');
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
                await page.evaluate(async theme => {
                    document.documentElement.dataset.theme = theme;
                    // Sample after the theme transition, including the body background.
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                }, mode);
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
                assert.equal(measurements.length, 17, 'Exercise all text roles and both code backgrounds.');
                for (const { role, highlighted, ratio } of measurements) {
                    // Corrected roles target 5:1 to leave room above the 4.5:1 normal-text floor.
                    const corrected = role === 'deleted' || (mode === 'light' && role === 'type')
                        || (mode === 'dark' && ['keyword', 'string'].includes(role));
                    const minimum = corrected ? 5 : 4.5;
                    assert(ratio >= minimum, `${mode}: ${role}${highlighted ? ' on highlighted line' : ''} is ${ratio.toFixed(3)}:1; needs ${minimum}:1.`);
                }
            }
            return { message: 'Light/dark deleted text and six code text roles pass on their actual backgrounds, with extra margin for corrected roles.' };
        }
    },
    {
        id: 'palette-neutral-customization',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Neutral Surfaces Follow the Palette and Keep Independent Roles',
        async run({ page, baseUrl }) {
            await gotoAndWait(page, baseUrl + '/zh/about/');
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
                await page.evaluate(theme => document.documentElement.dataset.theme = theme, mode);
                const baseline = await readColors();

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

            return { message: 'Light/dark surfaces follow background and foreground changes; shared borders and literal role overrides remain independent.' };
        }
    }
];
