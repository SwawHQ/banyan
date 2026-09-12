import assert from 'node:assert/strict';
import path from 'node:path';
import { gotoAndWait, waitForBreadcrumbSettled } from './helpers.mjs';

// Locator.click() uses layout-viewport coordinates on a panned mobile canvas.
async function activate(page, locator, touch = false) {
    await locator.evaluate(node => node.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'instant' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await clickVisible(page, locator, touch);
}

// Do not let the test's click preparation hide a canvas-position regression.
async function clickVisible(page, locator, touch) {
    const point = await locator.evaluate(node => {
        const box = node.getBoundingClientRect();
        const left = Math.max(0, box.left - visualViewport.offsetLeft);
        const right = Math.min(visualViewport.width, box.right - visualViewport.offsetLeft);
        if (right <= left) throw new Error('The control must be visible before clicking it.');
        return { x: (left + right) / 2, y: box.top - visualViewport.offsetTop + box.height / 2 };
    });
    if (touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export async function openDocumentAside(page, touch = false) {
    const toggle = page.locator('#document-aside-toggle');
    if (await toggle.getAttribute('aria-expanded') === 'false') await activate(page, toggle, touch);
    await page.waitForSelector('.document-aside', { state: 'visible' });
}

export const documentAsideScenarios = [{
    id: 'document-aside-navigation',
    kind: 'single',
    serviceWorkers: 'block',
    title: 'Metadata Paths and Chapter Navigation Share the Document Aside',
    async run({ page, baseUrl, artifactDir }) {
        const results = [];
        for (const prefix of ['', '/zh', '/zh-tw']) {
            await page.setViewportSize({ width: 1800, height: 900 });
            await gotoAndWait(page, `${baseUrl}${prefix}/p/swaw-kit-git/?from=all`);
            await waitForBreadcrumbSettled(page);
            await page.waitForFunction(() => document.querySelector('.document-toc [aria-current="location"]')?.hash === '#main');
            assert.equal(await page.locator('.document-aside').isVisible(), false);
            await openDocumentAside(page);
            const structure = await page.evaluate(() => ({
                label: document.querySelector('.document-toc').getAttribute('aria-label'),
                headings: [...document.querySelectorAll('.prose :is(h2,h3)')].map(h => ({ id: h.id, text: h.textContent.trim() })),
                entries: [...document.querySelectorAll('.document-toc a')].map(a => ({ id: decodeURIComponent(a.hash.slice(1)), text: a.querySelector('.collection-item-title').textContent.trim() })),
                nestedLists: document.querySelectorAll('.document-toc ul ul').length,
                taxonomy: [...document.querySelectorAll('.document-meta__row--taxonomy-path a')].map(a => new URL(a.href).pathname),
                directoryAfterTaxonomies: [...document.querySelectorAll('.document-meta__row--taxonomy-path')].every(row => row.compareDocumentPosition(document.querySelector('.document-meta__row--path')) & Node.DOCUMENT_POSITION_FOLLOWING),
                timeCount: document.querySelectorAll('.document-meta time').length,
                dateRowCount: new Set([...document.querySelectorAll('.document-meta time')].map(t => t.closest('.document-meta__row'))).size,
                dateIcons: [...document.querySelectorAll('.document-meta time')].map(t => t.closest('.document-meta__row').querySelector('use')?.getAttribute('href')),
                datesFirst: [...document.querySelector('.document-meta').children].slice(0, 2).every(row => row.querySelector('time')),
                rowGaps: [...document.querySelectorAll('.document-meta__row')].map(e => e.getBoundingClientRect()).map((box, i, boxes) => i > 0 ? box.top - boxes[i - 1].bottom : null).slice(1),
                platformIcons: [...document.querySelectorAll('.document-meta__row--resources use')].map(u => u.getAttribute('href')),
            }));
            assert.deepEqual(structure.entries[0], { id: 'main', text: structure.label });
            assert.deepEqual(structure.entries.slice(1), structure.headings, 'The article-start link precedes the Hugo headings in their original order.');
            assert(structure.entries.length > 10);
            assert(structure.taxonomy.includes(prefix + '/tags/tooling/devtools/windows/'));
            assert(structure.taxonomy.includes(prefix + '/tags/tooling/devtools/'));
            assert(structure.directoryAfterTaxonomies, 'Every taxonomy path precedes the directory path.');
            assert(structure.timeCount === 2 && structure.dateRowCount === 2, 'Updated and published dates occupy separate rows.');
            assert.deepEqual(structure.dateIcons, ['#icon-clock', '#icon-clock']);
            assert(structure.datesFirst, 'Both date rows precede taxonomy and directory paths.');
            assert.equal(structure.nestedLists, 0, 'H2 and H3 form one flat list.');
            assert(Math.max(...structure.rowGaps) - Math.min(...structure.rowGaps) <= 1, 'Metadata rows have uniform spacing.');
            assert(structure.platformIcons.includes('#icon-github'));
            if (prefix === '/zh') {
                assert(structure.platformIcons.includes('#icon-wechat'));
                const metadataPath = page.locator('.document-meta__row--taxonomy-path').first();
                await metadataPath.hover();
                assert.equal(await metadataPath.evaluate(e => getComputedStyle(e).backgroundColor), 'rgba(0, 0, 0, 0)', 'A multi-link metadata row has no hover background.');
                await page.screenshot({ path: path.join(artifactDir, 'desktop.png') });
            }
            results.push({ prefix, ...structure });
        }
        for (const width of [390, 1024, 1800]) {
            await page.setViewportSize({ width, height: 800 });
            await gotoAndWait(page, `${baseUrl}/zh/p/swaw-kit-git/?from=all`);
            await waitForBreadcrumbSettled(page);
            await openDocumentAside(page);
            await page.locator('.page-content').evaluate(column => {
                column.scrollTop = (column.querySelector('h2').getBoundingClientRect().top - column.getBoundingClientRect().top) / 2;
            });
            await page.waitForFunction(() => document.querySelector('.page-content').scrollTop > 0
                && document.querySelector('.document-toc [aria-current="location"]')?.hash === '#main');
            const link = page.locator('.document-toc a').nth(3);
            const fragment = await link.getAttribute('href');
            const assertTarget = async (stage) => {
                try {
                    await page.waitForFunction(() => {
                        const id = decodeURIComponent(location.hash.slice(1));
                        const target = document.getElementById(id);
                        if (!target) return false;
                        const box = target.getBoundingClientRect();
                        const main = document.querySelector('.page-content').getBoundingClientRect();
                        const active = document.querySelector('.document-toc [aria-current="location"]');
                        return box.top >= main.top - 1 && box.top <= main.top + 24
                            && main.left >= -1 && main.right <= innerWidth + 1
                            && active && decodeURIComponent(active.hash.slice(1)) === id;
                    }, null, { timeout: 5000 });
                } catch (error) {
                    const state = await page.evaluate(() => ({
                        url: location.href,
                        y: document.querySelector('.page-content')?.scrollTop,
                        active: document.querySelector('.document-toc [aria-current]')?.outerHTML
                    }));
                    throw new Error(`${stage}: ${JSON.stringify(state)}`, { cause: error });
                }
            };
            await link.click();
            await assertTarget('click');
            assert.equal(await page.locator('.document-aside').isVisible(), false, 'Selecting a chapter restores the reading boundary.');
            assert.equal(new URL(page.url()).search, '?from=all');
            await page.reload();
            await waitForBreadcrumbSettled(page);
            await assertTarget('reload');
            // Reading changes the highlight, never the URL or sidebar scroll.
            const before = await page.evaluate(() => ({ hash: location.hash, aside: document.querySelector('.document-aside').scrollTop }));
            await page.evaluate(() => { document.querySelector('.page-content').scrollTop = 100000; });
            await page.waitForFunction(() => {
                const links = [...document.querySelectorAll('.document-toc a')];
                return links.at(-1).getAttribute('aria-current') === 'location';
            });
            assert.deepEqual(await page.evaluate(() => ({ hash: location.hash, aside: document.querySelector('.document-aside').scrollTop })), before);
            const reading = await page.locator('.page-content').evaluate(e => e.scrollTop);
            await gotoAndWait(page, baseUrl + '/zh/language/');
            await page.goBack();
            await waitForBreadcrumbSettled(page);
            await assertTarget('back to chapter URL');
            // Direct links may use different percent-escape casing.
            await gotoAndWait(page, `${baseUrl}/zh/p/swaw-kit-git/?from=all#${encodeURIComponent(decodeURIComponent(fragment.slice(1)))}`);
            await waitForBreadcrumbSettled(page);
            await assertTarget('direct');
            await openDocumentAside(page);
            const overflow = await page.locator('.document-aside').evaluate(e => e.scrollWidth - e.clientWidth);
            assert(overflow <= 1, 'Long headings must wrap inside the aside.');
            await page.screenshot({ path: path.join(artifactDir, `aside-${width}.png`) });
            await page.locator('.document-toc a[href="#main"]').click();
            await assertTarget('return to article start');
            await page.reload();
            await waitForBreadcrumbSettled(page);
            await assertTarget('reload article start');
            assert.equal(await page.locator('.page-content').evaluate(e => e.scrollTop), 0);
            results.push({ width, reading, overflow });
        }
        await page.emulateMedia({ media: 'print' });
        assert.equal(await page.locator('.document-aside').isVisible(), true);
        assert.equal(await page.locator('#document-aside-toggle').isVisible(), false);
        assert.equal(await page.locator('.document-toc').isVisible(), false, 'The screen navigation should not duplicate the article when printed.');
        await page.emulateMedia({ media: 'screen' });
        await gotoAndWait(page, baseUrl + '/zh/icp/');
        assert.equal(await page.locator('.document-toc').count(), 0, 'No heading means no empty outline or outline script.');
        assert.equal(await page.locator('script[src*="document/toc"]').count(), 0);
        const noScript = await page.context().browser().newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
        try {
            const plain = await noScript.newPage();
            await plain.goto(baseUrl + '/zh/p/swaw-kit-git/?from=all');
            assert.equal(await plain.locator('#document-aside-toggle').isVisible(), false);
            assert.equal(await plain.locator('.document-aside').isVisible(), true);
            await plain.locator('.document-toc a').nth(3).click();
            assert(await plain.locator('.page-content').evaluate(e => e.scrollTop > 0), 'Outline links work without JavaScript.');
            await plain.locator('.document-toc a[href="#main"]').click();
            assert.equal(await plain.locator('.page-content').evaluate(e => e.scrollTop), 0, 'The article-start link works without JavaScript.');
        } finally { await noScript.close(); }
        return { results };
    }
}, ...[true, false].map(mobile => ({
    id: mobile ? 'document-aside-mobile-toggle' : 'document-aside-desktop-toggle',
    kind: 'single',
    serviceWorkers: 'block',
    isMobile: mobile,
    hasTouch: mobile,
    title: 'Aside Disclosure Preserves the Reading Column and Its Scroll Position',
    async run({ page, baseUrl, artifactDir }) {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/js/document/aside.*.js', async route => {
            await new Promise(resolve => setTimeout(resolve, 400));
            await route.continue();
        });
        await page.addInitScript(() => {
            window.__asideFirstFrames = [];
            function record() {
                const aside = document.getElementById('document-aside');
                if (aside) window.__asideFirstFrames.push(getComputedStyle(aside).display);
                if (document.readyState !== 'complete') requestAnimationFrame(record);
            }
            requestAnimationFrame(record);
        });
        const read = () => page.evaluate(() => {
            const content = document.querySelector('.page-content');
            const main = document.getElementById('main').getBoundingClientRect();
            return {
                width: main.width, height: content.scrollHeight, y: content.scrollTop,
                left: main.left - visualViewport.offsetLeft, right: main.right - visualViewport.offsetLeft,
                x: visualViewport.pageLeft, canvasWidth: document.scrollingElement.scrollWidth,
                viewport: visualViewport.width,
            };
        });
        const results = [];
        for (const width of mobile ? [320, 390, 430] : [768, 1800]) {
            await page.setViewportSize({ width, height: 844 });
            await gotoAndWait(page, baseUrl + '/zh/p/ssh-remote-kit-windows/?from=all');
            await waitForBreadcrumbSettled(page);
            const frames = await page.evaluate(() => window.__asideFirstFrames);
            assert(frames.length > 0 && frames.every(display => display === 'none'), 'The aside is absent from the first frame, even with a delayed controller.');
            await page.locator('.page-shell').evaluate(node => node.scrollIntoView({ inline: 'end', block: 'nearest', behavior: 'instant' }));
            const collapsed = await read();
            assert(collapsed.left >= 7 && collapsed.right <= collapsed.viewport - 7, JSON.stringify(collapsed));
            const toggle = page.locator('#document-aside-toggle');
            assert.equal(await toggle.getAttribute('aria-controls'), 'document-aside');
            assert(await toggle.evaluate(node => node.getBoundingClientRect().height >= 44));
            assert.equal(await page.locator('.document-aside button').count(), 0, 'The title control is the only aside toggle.');
            const paint = locator => locator.evaluate(async node => {
                // Navigation anchors animate color on hover and theme changes.
                await Promise.all(node.getAnimations().map(animation => animation.finished));
                return {
                    color: getComputedStyle(node).color,
                    background: getComputedStyle(node, '::before').backgroundColor,
                    ring: getComputedStyle(node, '::before').boxShadow,
                    underline: getComputedStyle(node.querySelector('.collection-item-title')).textDecorationThickness,
                };
            });
            for (const theme of ['light', 'dark']) {
                await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
                if (!mobile) {
                    const reference = page.locator('[data-root-navigation] .collection-item-link:not(.is-current)').first();
                    await reference.hover();
                    const preview = await paint(reference);
                    await toggle.hover();
                    assert.deepEqual(await paint(toggle), preview, 'The unselected control reuses the navigation hover style.');
                    await page.mouse.move(0, 0);
                }
                if (width === 390 || width === 1800) await page.screenshot({ path: path.join(artifactDir, `collapsed-${width}-${theme}.png`) });
                const beforeToggle = await read();
                await clickVisible(page, toggle, mobile);
                const opened = await read();
                assert.equal(opened.width, collapsed.width);
                assert.equal(opened.height, collapsed.height);
                assert.equal(opened.x, beforeToggle.x, 'Opening the aside preserves the user-chosen canvas position.');
                assert.equal(opened.left, beforeToggle.left, 'Opening the aside does not move the reading column.');
                assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
                assert.equal(await page.locator('.document-aside').evaluate(node => node.contains(document.activeElement)), false,
                    'Pointer activation does not transfer focus into the aside.');
                assert.deepEqual(await paint(toggle), await paint(page.locator('[data-root-navigation] .collection-item-link.is-current')), 'Expanded state reuses the selected navigation style.');
                assert.equal(await toggle.evaluate(node => getComputedStyle(node).borderTopWidth), '0px');
                if (width === 390 || width === 1800) await page.screenshot({ path: path.join(artifactDir, `opened-${width}-${theme}.png`) });
                await clickVisible(page, toggle, mobile);
                assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'Clicking the selected title control closes the aside.');
                assert.equal(await page.locator('.document-aside').isVisible(), false);
                assert.equal((await read()).x, beforeToggle.x, 'Closing from the title control preserves the canvas position.');
                await openDocumentAside(page, mobile);
                await page.locator('.page-content').evaluate(node => { node.scrollTop = 700; });
                // Simulate keyboard focus in the aside without panning to it.
                await page.locator('.document-aside a').first().evaluate(node => node.focus({ preventScroll: true }));
                const beforeEscape = await read();
                await page.keyboard.press('Escape');
                const closed = await read();
                assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
                assert.equal(closed.y, 700);
                assert.equal(closed.width, collapsed.width);
                assert.equal(closed.x, beforeEscape.x, 'Escape does not request a horizontal realignment.');
                assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
                await page.locator('.page-content').evaluate(node => { node.scrollTop = 0; });
            }
            // The user may leave main partly visible instead of aligning its edge.
            await page.locator('.page-content').evaluate(node => {
                node.style.scrollMarginInlineStart = '40px';
                node.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'instant' });
                node.style.scrollMarginInlineStart = '';
            });
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const partial = await read();
            await clickVisible(page, toggle, mobile);
            assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
            assert.equal((await read()).x, partial.x, 'Opening from a partially visible article does not realign it.');
            await clickVisible(page, toggle, mobile);
            assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
            assert.equal((await read()).x, partial.x, 'Closing from a partially visible article does not realign it.');
            // Once the user pans past the closed boundary, removing the column
            // must let the browser clamp x instead of preserving an empty track.
            if (width < 1800) {
                await openDocumentAside(page, mobile);
                await page.locator('.page-content').evaluate((node, x) => {
                    node.style.scrollMarginInlineStart = `${node.getBoundingClientRect().left + scrollX - x}px`;
                    node.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'instant' });
                    node.style.scrollMarginInlineStart = '';
                }, collapsed.x + 100);
                await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                const beyondBoundary = await read();
                assert(beyondBoundary.x > collapsed.x + 90, 'Exercise a viewport beyond the closed canvas boundary.');
                await clickVisible(page, toggle, mobile);
                const clamped = await read();
                assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
                assert.equal(clamped.x, collapsed.x, 'Closing only clamps to the new native boundary.');
                assert.equal(clamped.canvasWidth, collapsed.canvasWidth, 'The closed aside leaves no reserved blank width.');
                assert.equal(clamped.y, beyondBoundary.y, 'Native horizontal clamping preserves reading progress.');
            }
            await openDocumentAside(page, mobile);
            await activate(page, page.locator('.document-toc a').nth(2), mobile);
            await page.waitForFunction(() => location.hash && document.querySelector('.page-content').scrollTop > 0);
            assert.equal(await page.locator('.document-aside').isVisible(), false);
            const chapter = await read();
            assert(chapter.left >= -1 && chapter.right <= chapter.viewport + 1);
            if (!mobile) {
                await page.locator('.page-content').evaluate(node => { node.scrollTop = 0; });
                await toggle.focus();
                const beforeKeyboard = await read();
                await page.keyboard.press('Enter');
                assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
                assert.equal((await read()).x, beforeKeyboard.x);
                assert.equal(await page.evaluate(() => document.activeElement.id), 'document-aside-toggle');
                await page.keyboard.press('Escape');
                assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
                assert.equal((await read()).x, beforeKeyboard.x);
                await page.keyboard.press('Space');
                assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
                await page.keyboard.press('Space');
                assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
                assert.equal((await read()).x, beforeKeyboard.x);
            }
            results.push({ width, collapsed, chapter, firstFrames: frames.length });
        }
        for (const route of ['/zh/icp/', '/zh/language/', '/zh/all/', '/offline/']) {
            await gotoAndWait(page, baseUrl + route);
            assert.equal(await page.locator('#document-aside-toggle').count(), 0, `No empty control on ${route}.`);
            assert.equal(await page.locator('script[src*="document/aside."]').count(), 0);
        }
        await gotoAndWait(page, baseUrl + '/zh/about/');
        assert.equal(await page.locator('.slot-meta').count(), 0);
        await openDocumentAside(page, mobile);
        assert.equal(await page.locator('#document-aside-toggle').textContent(), '章节');
        assert.deepEqual(errors, []);
        return { results };
    }
}))];
