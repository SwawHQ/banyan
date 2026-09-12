import assert from 'node:assert/strict';
import { documentAsideScenarios, openDocumentAside } from './document-aside.mjs';
import path from 'node:path';
import {
    gotoAndWait,
    readFirstMainLayout,
    recordFirstMainLayoutScript,
    waitForBreadcrumbSettled
} from './helpers.mjs';

const articlePath = '/zh/p/wsl-guide/?from=%2Ftags%2Ftooling%2Fdevtools%2Fwindows%2Fwsl';
const viewports = [390, 1024, 1440].map(width => ({ width, height: 900 }));
const nextPaint = page => page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
}));
const position = page => page.evaluate(() => ({ x: scrollX }));

async function assertPosition(page, expected, label) {
    await page.waitForFunction(({ x }) => (
        Math.abs(scrollX - x) <= 1
    ), expected, { timeout: 5000 });
    assert.deepEqual(await position(page), expected, label);
}

async function readCanvas(page) {
    return page.evaluate(() => {
        const offsetLeft = window.visualViewport?.offsetLeft || 0;
        const offsetTop = window.visualViewport?.offsetTop || 0;
        const rect = node => {
            const box = node.getBoundingClientRect();
            return {
                x: box.x - offsetLeft, y: box.y - offsetTop,
                width: box.width, height: box.height, right: box.right - offsetLeft
            };
        };
        const nav = document.querySelector('[data-root-navigation]');
        const main = document.querySelector('#main');
        const columns = [...document.querySelectorAll('.slot-breadcrumb [data-collection-column]')];
        const footer = document.querySelector('.slot-footer');
        const prose = document.querySelector('.prose');
        return {
            main: rect(main),
            mainDocumentX: main.getBoundingClientRect().x + scrollX,
            nav: rect(nav),
            columns: columns.map(rect),
            columnLinks: columns.map(column => column.querySelectorAll('[data-collection-entry][href]').length),
            plainColumns: columns.every(column => (
                column.querySelector(':scope > .collection-list.collection-list--path-column')
                && !column.querySelector('[aria-expanded], [role="menu"], [hidden]')
            )),
            obsoleteControls: document.querySelectorAll('.breadcrumb-item-menu, .breadcrumb-menu-panel, .breadcrumb-menu-trigger').length,
            rootCount: nav.querySelectorAll('[data-root-href]').length,
            prose: prose ? rect(prose) : null,
            proseOverflow: prose ? prose.scrollWidth - prose.clientWidth : 0,
            footer: footer ? rect(footer) : null,
            footerInRail: !footer || footer.closest('.page-rail') !== null,
            viewport: window.visualViewport?.width || document.documentElement.clientWidth,
            layoutViewportWidth: innerWidth,
            visualViewport: window.visualViewport ? {
                width: visualViewport.width, offsetLeft: visualViewport.offsetLeft, scale: visualViewport.scale
            } : null,
            scrollWidth: document.scrollingElement.scrollWidth,
            canvasOffsetX: window.visualViewport?.pageLeft ?? scrollX,
            canvasOffsetY: window.visualViewport?.pageTop ?? scrollY,
            scrollX,
            scrollY
        };
    });
}

export const canvasScenarios = [
    ...documentAsideScenarios,
    {
        id: 'canvas-source-navigation',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        title: 'Opening an Article Retains Source Columns and Clicking It Again Keeps the Document',
        async run({ page, baseUrl }) {
            await page.addInitScript(() => {
                const observer = new MutationObserver(() => {
                    if (!document.querySelector('#main')) return;
                    window.__sourceNav = document.querySelector('.slot-breadcrumb .path-navigation');
                    window.__sourceColumns = [...document.querySelectorAll('.slot-breadcrumb .path-column')];
                    observer.disconnect();
                });
                observer.observe(document, { childList: true, subtree: true });
            });
            await page.route('**/js/browse/path-entry.*.js', async route => {
                await new Promise(resolve => setTimeout(resolve, 350));
                await route.continue();
            });
            // Click only the visible portion, without locator.click() revealing the whole row.
            const clickVisible = async link => {
                const point = await link.evaluate(el => {
                    const box = el.getBoundingClientRect();
                    const left = box.x - (visualViewport?.offsetLeft || 0);
                    return {
                        x: (Math.max(0, left) + Math.min(innerWidth, left + box.width)) / 2,
                        y: box.y + box.height / 2
                    };
                });
                await page.touchscreen.tap(point.x, point.y);
            };
            const cases = [];
            for (const [source, slug, x] of [
                ['tags/tooling', 'coskill-trustworthy-collaboration', 360],
                ['tags/tooling/devtools/windows', 'xvenv', 900]
            ]) {
                await gotoAndWait(page, `${baseUrl}/zh/${source}/`);
                await waitForBreadcrumbSettled(page);
                await page.evaluate(x => scrollTo(x, 0), x);
                await nextPaint(page);
                const before = await readCanvas(page);
                assert.equal(before.canvasOffsetX, x);
                await clickVisible(page.locator(`main [data-collection-entry][href*="/p/${slug}/"]`));
                await page.waitForURL(url => url.pathname === `/zh/p/${slug}/`);
                await waitForBreadcrumbSettled(page);
                await nextPaint(page);
                const after = await readCanvas(page);
                assert.equal(after.canvasOffsetX, before.canvasOffsetX,
                    'Source hydration must not reset a panned canvas in WebKit.');
                assert.equal(after.nav.x, before.nav.x);
                before.columns.forEach((column, index) => assert.equal(after.columns[index].x, column.x));
                assert.equal(after.columns.at(-1).x, before.main.x);
                assert(after.mainDocumentX > before.mainDocumentX);
                assert.equal(await page.evaluate(() => {
                    const nav = window.__sourceNav;
                    return nav?.isConnected && !nav.hasAttribute('aria-hidden')
                        && nav.getAttribute('aria-label') === 'Breadcrumb'
                        && window.__sourceColumns.length === nav.children.length
                        && window.__sourceColumns.every((column, index) => column === nav.children[index]);
                }), true, 'The reserved column containers must survive source hydration.');

                const readingY = await page.evaluate(() => {
                    window.__sameEntryDocument = true;
                    const content = document.querySelector('.page-content');
                    content.scrollTop = 120;
                    return content.scrollTop;
                });
                assert(readingY > 0, 'Exercise an existing article reading position.');
                const selected = page.locator(`.slot-breadcrumb [aria-current="page"][href*="/p/${slug}/"]`);
                const selectedHref = await selected.evaluate(el => el.href);
                assert.equal(selectedHref, page.url());
                let documentRequests = 0;
                const recordRequest = request => {
                    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests += 1;
                };
                page.on('request', recordRequest);
                await clickVisible(selected);
                await nextPaint(page);
                assert.equal(documentRequests, 0, 'Clicking the selected article must not reload the document.');
                page.off('request', recordRequest);
                assert.deepEqual(await page.evaluate(() => ({
                    retained: window.__sameEntryDocument,
                    x: visualViewport?.pageLeft ?? scrollX,
                    y: document.querySelector('.page-content').scrollTop,
                    pending: sessionStorage.getItem('banyan:canvas-navigation')
                })), { retained: true, x, y: readingY, pending: null });
                cases.push({ source, before: before.canvasOffsetX, after: after.canvasOffsetX, readingY });
            }
            return { cases };
        }
    },
    {
        id: 'canvas-path-sort-reuses-dom',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: { width: 1440, height: 130 },
        title: 'Sorting Reuses Server-rendered Path Rows, Headers and Links',
        async run({ page, baseUrl }) {
            await page.addInitScript(() => {
                const observer = new MutationObserver(() => {
                    if (!document.querySelector('#main')) return;
                    window.__pathNodes = [...document.querySelectorAll('.path-column')].map(column => ({
                        column,
                        header: column.querySelector('[data-collection-header]'),
                        links: [...column.querySelectorAll('[data-collection-entry]')],
                        icons: [...column.querySelectorAll('.collection-item-icon')]
                    }));
                    observer.disconnect();
                });
                observer.observe(document, { childList: true, subtree: true });
            });
            await page.route('**/js/browse/path-entry.*.js', async route => {
                await new Promise(resolve => setTimeout(resolve, 400));
                await route.continue();
            });
            await gotoAndWait(page, `${baseUrl}/tags/tooling/devtools/?sorts=date-desc,date-asc`);
            await waitForBreadcrumbSettled(page);
            const retained = () => page.evaluate(() => window.__pathNodes.every(({ column, header, links, icons }) =>
                column.isConnected && header?.isConnected && links.length > 0
                && links.every(link => link.isConnected && column.contains(link))
                && icons.every(icon => icon.isConnected && column.contains(icon))));
            assert.equal(await retained(), true, 'Initial sort must reuse SSR rows instead of replacing them with placeholders.');

            const target = '.path-column[data-breadcrumb-collection-href="/tags/tooling/"]';
            const before = await page.locator(target).evaluate(column => {
                const link = column.querySelector('[href*="/p/coskill-trustworthy-collaboration/"]');
                const url = new URL(link.href);
                url.searchParams.set('note', 'keep');
                url.hash = 'reading';
                link.href = url.href;
                const toggle = column.querySelector('[data-collection-sort-toggle]');
                toggle.focus({ preventScroll: true });
                column.scrollTop = 35;
                return {
                    y: column.scrollTop,
                    order: [...column.querySelectorAll('[data-collection-entry]')].map(a => new URL(a.href).pathname)
                };
            });
            assert(before.y > 0, 'Exercise a scrolled column.');
            for (const attempt of [0, 1]) {
                await page.locator(`${target} [data-collection-sort-toggle]`).evaluate(toggle => toggle.click());
                await nextPaint(page);
                const after = await page.locator(target).evaluate(column => {
                    const link = column.querySelector('[href*="/p/coskill-trustworthy-collaboration/"]');
                    return {
                        y: column.scrollTop,
                        href: link.href,
                        focused: document.activeElement === column.querySelector('[data-collection-sort-toggle]'),
                        order: [...column.querySelectorAll('[data-collection-entry]')].map(a => new URL(a.href).pathname)
                    };
                });
                assert.equal(await retained(), true, 'Click sorting must preserve row, icon and header identity.');
                assert.equal(after.focused, true);
                assert.equal(after.y, before.y);
                const url = new URL(after.href);
                assert.equal(url.searchParams.get('from'), 'tags/tooling');
                assert.equal(url.searchParams.get('note'), 'keep');
                assert.equal(url.hash, '#reading');
                if (attempt === 0) assert.notDeepEqual(after.order, before.order);
                else assert.deepEqual(after.order, before.order);
            }
            return { preservedNodes: true, scrollTop: before.y };
        }
    },
    {
        id: 'canvas-path-entry-lineage',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Path Column Article Links Keep Their Source Before and After Rendering',
        async run({ page, baseUrl }) {
            const selector = '.slot-breadcrumb a[href*="/p/coskill-trustworthy-collaboration/"]';
            const cases = [];
            for (const lang of ['', 'zh/', 'zh-tw/']) {
                for (const [route, from] of [
                    ['tags/tooling/devtools/', 'tags/tooling'],
                    ['p/loop-engineering-digital-life-origin/', 'd']
                ]) {
                    const url = `${baseUrl}/${lang}${route}`;
                    const response = await page.request.get(url);
                    assert.equal(response.status(), 200);
                    // Parse the response without executing scripts: the href
                    // must already work before hydration, including with JS off.
                    const rawHref = await page.evaluate(({ html, selector }) =>
                        new DOMParser().parseFromString(html, 'text/html')
                            .querySelector(selector)?.getAttribute('href'),
                    { html: await response.text(), selector });
                    assert(rawHref, `Missing source-column article link: ${url}`);
                    assert.equal(new URL(rawHref, baseUrl).searchParams.get('from'), from, url);
                    await gotoAndWait(page, url);
                    await waitForBreadcrumbSettled(page);
                    const rendered = await page.locator(selector).getAttribute('href');
                    assert.equal(new URL(rendered, baseUrl).searchParams.get('from'), from);
                    cases.push({ url, rawHref, rendered });
                }
                for (const query of ['', '?from=tags/tooling', '?sorts=date-desc,date-asc']) {
                    await gotoAndWait(page, `${baseUrl}/${lang}tags/tooling/devtools/${query}`);
                    await waitForBreadcrumbSettled(page);
                    await page.locator(selector).click();
                    await page.waitForURL(url => url.pathname === `/${lang}p/coskill-trustworthy-collaboration/`);
                    assert.equal(new URL(page.url()).searchParams.get('from'), 'tags/tooling');
                    await page.reload();
                    assert.equal(new URL(page.url()).searchParams.get('from'), 'tags/tooling');
                }
            }
            return { cases };
        }
    },
    ...[false, true].map(mobile => ({
        id: mobile ? 'canvas-mobile-native-scrollbar' : 'canvas-desktop-auto-scrollbar',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: { width: mobile ? 390 : 1440, height: 900 },
        isMobile: mobile,
        hasTouch: mobile,
        title: 'Resizing and Scrolling Preserve Column Width and the Metadata Gap',
        async run({ page, baseUrl }) {
            await gotoAndWait(page, `${baseUrl}/zh/p/xvenv/?from=all`);
            await openDocumentAside(page, mobile);
            const read = () => page.locator('.page-content').evaluate(column => {
                const aside = document.querySelector('.document-aside').getBoundingClientRect();
                const scrollbar = column.offsetWidth - column.clientWidth;
                return {
                    color: getComputedStyle(column).scrollbarColor,
                    nestedColor: getComputedStyle(column.firstElementChild).scrollbarColor,
                    width: column.clientWidth,
                    scrollbar,
                    gap: aside.left - column.getBoundingClientRect().right,
                    expectedGap: parseFloat(getComputedStyle(column.parentElement).columnGap),
                    overflowX: column.scrollWidth - column.clientWidth,
                    scrollable: column.scrollHeight > column.clientHeight,
                    y: column.scrollTop
                };
            });
            const hidden = 'rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)';
            const cases = [];
            for (const width of mobile ? [390, 768, 390] : [1800, 1440, 1024, 1800]) {
                await page.setViewportSize({ width, height: 900 });
                const resized = await read();
                assert.equal(resized.color, mobile ? 'auto' : hidden);
                assert.equal(resized.nestedColor, 'auto');
                await page.locator('.page-content').evaluate(column => { column.scrollTop += 100; });
                await page.waitForFunction(() => document.querySelector('.page-content').hasAttribute('data-scrolling'));
                const active = await read();
                assert.equal(active.color, 'auto');
                await page.waitForFunction(() => !document.querySelector('.page-content').hasAttribute('data-scrolling'));
                const idle = await read();
                assert.equal(idle.color, resized.color);
                for (const state of [resized, active, idle]) {
                    assert.equal(state.width, resized.width);
                    assert(Math.abs(state.gap - state.expectedGap) <= 1, JSON.stringify(state));
                    assert.equal(state.overflowX, 0, JSON.stringify(state));
                }
                assert.equal(idle.y, active.y);
                assert(idle.y > 0);
                cases.push({ width, resized, active, idle });
            }
            // The same real article must retain its gap when no scrolling is needed.
            const height = await page.locator('.page-content').evaluate(column => column.scrollHeight + 100);
            await page.setViewportSize({ width: mobile ? 390 : 1800, height });
            const short = await read();
            assert.equal(short.scrollable, false, JSON.stringify(short));
            assert(Math.abs(short.gap - short.expectedGap) <= 1, JSON.stringify(short));
            return { cases, short };
        }
    })),
    {
        id: 'canvas-document-aside',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Document Metadata Occupies an Independent Right Column',
        async run({ page, baseUrl, artifactDir }) {
            const cases = [];
            for (const width of [390, 1024, 1600]) {
                await page.setViewportSize({ width, height: 300 });
                for (const prefix of ['', '/zh', '/zh-tw']) {
                    await gotoAndWait(page, `${baseUrl}${prefix}/p/xvenv/?from=all`);
                    await waitForBreadcrumbSettled(page);
                    await openDocumentAside(page);
                    const state = await page.evaluate(() => {
                        const main = document.querySelector('.page-content');
                        const aside = document.querySelector('.document-aside');
                        const right = aside.getBoundingClientRect();
                        const gap = parseFloat(getComputedStyle(document.documentElement).fontSize);
                        const top = right.top;
                        const initialX = scrollX;
                        main.scrollTop = 200;
                        const readingY = main.scrollTop;
                        const asideUnmoved = aside.scrollTop === 0 && aside.getBoundingClientRect().top === top;
                        aside.scrollTop = 100000;
                        const independent = main.scrollTop === readingY && aside.scrollTop > 0 && scrollX === initialX;
                        return {
                            sibling: main.parentElement === aside.parentElement,
                            followsMain: main.nextElementSibling === aside,
                            gap: right.left - main.getBoundingClientRect().right,
                            expectedGap: gap,
                            asideWidth: right.width, expectedWidth: Math.min(30 * gap, document.querySelector('.page').clientWidth),
                            topDifference: right.top - document.querySelector('[data-root-navigation]').getBoundingClientRect().top,
                            overflow: aside.scrollWidth - aside.clientWidth,
                            readingY, asideUnmoved, independent,
                            metaRows: aside.querySelectorAll('.document-meta__row--taxonomy-path').length,
                        };
                    });
                    assert(state.sibling && state.followsMain, JSON.stringify(state));
                    assert(Math.abs(state.gap - state.expectedGap) <= 1, JSON.stringify(state));
                    assert(Math.abs(state.asideWidth - state.expectedWidth) <= 1, JSON.stringify(state));
                    assert(Math.abs(state.topDifference) <= 1 && state.overflow <= 1, JSON.stringify(state));
                    assert(state.readingY > 0 && state.asideUnmoved && state.independent, JSON.stringify(state));
                    assert(state.metaRows >= 3, 'Product and content taxonomy paths must remain present.');
                    cases.push({ width, prefix, ...state });
                }
            }
            for (const width of [390, 1600]) {
                await page.setViewportSize({ width, height: 900 });
                await gotoAndWait(page, `${baseUrl}/zh/p/coskill-trustworthy-collaboration/?from=all`);
                await waitForBreadcrumbSettled(page);
                await openDocumentAside(page);
                if (width === 390) await page.locator('.document-aside').scrollIntoViewIfNeeded();
                await page.screenshot({ path: path.join(artifactDir, `aside-${width}.png`) });
            }
            await page.emulateMedia({ media: 'print' });
            const printed = await page.evaluate(() => {
                const main = document.querySelector('.page-content');
                const aside = document.querySelector('.document-aside');
                return {
                    below: aside.getBoundingClientRect().top >= main.getBoundingClientRect().bottom,
                    overflow: getComputedStyle(aside).overflowY,
                    clipped: aside.scrollHeight > aside.clientHeight + 1 || main.scrollHeight > main.clientHeight + 1,
                };
            });
            assert(printed.below && printed.overflow === 'visible' && !printed.clipped, JSON.stringify(printed));
            await page.emulateMedia({ media: 'screen' });
            for (const route of ['/zh/all/', '/zh/language/']) {
                await gotoAndWait(page, baseUrl + route);
                assert.equal(await page.locator('.document-aside').count(), 0, `No empty sidebar on ${route}`);
            }
            await gotoAndWait(page, baseUrl + '/zh/about/');
            assert.equal(await page.locator('.slot-meta').count(), 0);
            assert.equal(await page.locator('.document-toc').count(), 1, 'An article outline is independent of the metadata slot.');
            return { cases, printed };
        }
    },
    {
        id: 'canvas-column-scroll-ownership',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'The Document Pans Horizontally and Each Column Scrolls Vertically',
        async run({ page, baseUrl, artifactDir }) {
            const cases = [];
            for (const width of [390, 500, 1440]) {
                await page.setViewportSize({ width, height: 300 });
                await gotoAndWait(page, `${baseUrl}/zh/p/ssh-remote-kit-windows/?from=all`);
                await waitForBreadcrumbSettled(page);
                await openDocumentAside(page);
                const state = await page.evaluate(() => {
                    const doc = document.scrollingElement;
                    const content = document.querySelector('.page-content');
                    const columns = [...document.querySelectorAll('.page-rail, .path-column, .page-content, .document-aside')];
                    for (const column of columns) column.scrollTop = 100000;
                    return {
                        documentHeight: doc.scrollHeight, viewportHeight: doc.clientHeight,
                        rootY: scrollY, readingY: content.scrollTop,
                        metaInContent: content.contains(document.querySelector('.slot-meta')),
                        metaInAside: document.querySelector('.document-aside')?.contains(document.querySelector('.slot-meta')),
                        columns: columns.map(column => ({
                            className: column.className,
                            x: column.scrollLeft,
                            y: column.scrollTop,
                            clientWidth: column.clientWidth, scrollWidth: column.scrollWidth,
                            bottom: column.getBoundingClientRect().bottom
                        }))
                    };
                });
                assert.equal(state.documentHeight, state.viewportHeight, 'Offscreen articles must not extend the document vertically.');
                assert.equal(state.rootY, 0);
                assert(!state.metaInContent && state.metaInAside && state.readingY > 0, 'Article metadata has its own sibling scroller.');
                assert(state.columns.filter(column => column.className !== 'document-aside').every(column => column.y > 0), 'Short screens must expose the bottom of every long column.');
                assert(state.columns.every(column => column.x === 0 && column.scrollWidth <= column.clientWidth + 1), JSON.stringify(state));
                assert(state.columns.every(column => column.bottom <= state.viewportHeight + 1));
                await page.screenshot({ path: path.join(artifactDir, `columns-${width}.png`) });
                cases.push({ width, ...state });
                for (const route of ['all', 'd', 'all-products']) {
                    await gotoAndWait(page, `${baseUrl}/zh/${route}/`);
                    const overflow = await page.locator('.page-content').evaluate(column => column.scrollWidth - column.clientWidth);
                    assert(overflow <= 1, `/${route}/ must extend the page horizontally without an inner scrollbar.`);
                }
            }
            return { cases };
        }
    },
    ...[false, true].map(mobile => ({
        id: mobile ? 'canvas-mobile-append-column' : 'canvas-append-column',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: { width: 390, height: 900 },
        isMobile: mobile,
        hasTouch: mobile,
        timeoutMs: 60000,
        title: 'Opening a Product Appends a Column Without Moving Existing Names',
        async run({ page, context, baseUrl, artifactDir }) {
            const cases = [];
            const cdp = mobile ? await context.newCDPSession(page) : null;
            await page.addInitScript(() => {
                const observer = new MutationObserver(() => {
                    if (!document.getElementById('main')) return;
                    observer.disconnect();
                    requestAnimationFrame(() => {
                        window.__firstCanvasX = window.visualViewport?.pageLeft ?? scrollX;
                    });
                });
                observer.observe(document, { childList: true, subtree: true });
            });
            await page.route('**/js/**/*.js', async route => {
                await new Promise(resolve => setTimeout(resolve, 500));
                await route.continue();
            });
            for (const width of mobile ? [390] : [390, 1024, 1440]) {
                if (!mobile) await page.setViewportSize({ width, height: 900 });
                for (const source of ['products/free', 'all-products']) {
                    await gotoAndWait(page, `${baseUrl}/zh/${source}/`);
                    await waitForBreadcrumbSettled(page);
                    assert.equal((await readCanvas(page)).canvasOffsetX, 0);
                    if (source === 'products') {
                        if (mobile) {
                            const sortPoint = await page.locator('main [data-sort-field="name"]').evaluate(el => {
                                const box = el.getBoundingClientRect();
                                return { x: box.x - visualViewport.offsetLeft + 10, y: box.y + 5 };
                            });
                            await page.touchscreen.tap(sortPoint.x, sortPoint.y);
                        } else {
                            await page.locator('main [data-sort-field="price"]').click();
                        }
                        await page.waitForURL(url => url.searchParams.get('sort') === (mobile ? 'name-desc' : 'price-desc'));
                        assert.equal(await page.evaluate(() => sessionStorage.getItem('banyan:canvas-navigation')), null,
                            'In-place sorting does not create a pending navigation.');
                    }
                    const link = page.locator('main .collection-item-link[href*="/p/xvenv/"]');
                    if (width === 390) {
                        if (mobile) {
                            await cdp.send('Input.dispatchTouchEvent', {
                                type: 'touchStart', touchPoints: [{ x: 350, y: 180, id: 1 }]
                            });
                            const distance = source === 'products' ? 160 : 320;
                            for (let offset = 20; offset <= distance; offset += 20) {
                                await page.waitForTimeout(40);
                                await cdp.send('Input.dispatchTouchEvent', {
                                    type: 'touchMove', touchPoints: [{ x: 350 - offset, y: 180, id: 1 }]
                                });
                            }
                            await page.waitForTimeout(120);
                            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                        } else {
                            await page.evaluate(x => scrollTo(x, 0), source === 'products' ? 150 : 310);
                        }
                    }
                    await nextPaint(page);
                    const before = await readCanvas(page);
                    if (width === 390) assert.ok(before.canvasOffsetX > 0, 'Exercise a manually panned source.');
                    const name = await link.evaluate(el => {
                        const box = el.getBoundingClientRect();
                        return { x: box.x - (visualViewport?.offsetLeft || 0), y: box.y, width: box.width };
                    });
                    assert.ok(Math.abs(name.width - before.nav.width) <= 1, 'Product names share the navigation column width.');
                    await page.screenshot({ path: path.join(artifactDir, `${source.replaceAll('/', '-')}-${width}-before.png`) });
                    // The page canvas can pan past the label's start; tap its visible portion.
                    const visibleLeft = Math.max(0, name.x);
                    const visibleRight = Math.min(width, name.x + name.width);
                    assert.ok(visibleRight > visibleLeft, 'The panned product row remains visible.');
                    const point = { x: (visibleLeft + visibleRight) / 2, y: name.y + 10 };
                    assert.ok(point.x > 0 && point.x < width);
                    if (mobile) await page.touchscreen.tap(point.x, point.y);
                    else await page.mouse.click(point.x, point.y);
                    await page.waitForURL(url => url.pathname === '/zh/p/xvenv/');
                    await waitForBreadcrumbSettled(page);
                    await nextPaint(page);
                    const after = await readCanvas(page);
                    const firstX = await page.evaluate(() => window.__firstCanvasX);
                    assert.ok(Math.abs(firstX - before.canvasOffsetX) <= 1, 'The inherited position is already correct at first paint, before slow runtime scripts.');
                    if (source === 'products') assert.equal(new URL(page.url()).searchParams.get('sort'), mobile ? 'name-desc' : 'price-desc');
                    assert.ok(Math.abs(after.canvasOffsetX - before.canvasOffsetX) <= 1, 'Opening a product retains the source canvas position.');
                    assert.equal(after.canvasOffsetY, 0, 'The new article starts at its top.');
                    assert.ok(Math.abs(after.nav.x - before.nav.x) <= 1, 'Root entries stay in place.');
                    before.columns.forEach((column, i) => assert.ok(Math.abs(column.x - after.columns[i].x) <= 1));
                    const selected = await page.locator('.slot-breadcrumb .collection-item-link[aria-current="page"][href*="/p/xvenv/"]').evaluate(el => {
                        const box = el.getBoundingClientRect();
                        return { x: box.x - (visualViewport?.offsetLeft || 0), width: box.width };
                    });
                    assert.ok(Math.abs(selected.x - name.x) <= 1 && Math.abs(selected.width - name.width) <= 1,
                        'The clicked name remains in the same position and width in the new sibling column.');
                    assert.ok(after.mainDocumentX > before.mainDocumentX, 'The new main column extends the canvas to the right.');
                    assert.equal(await page.evaluate(() => sessionStorage.getItem('banyan:canvas-navigation')), null, 'The one-navigation record is consumed.');
                    await page.screenshot({ path: path.join(artifactDir, `${source.replaceAll('/', '-')}-${width}-after.png`) });
                    await page.reload();
                    await waitForBreadcrumbSettled(page);
                    assert.ok(Math.abs((await readCanvas(page)).canvasOffsetX - after.canvasOffsetX) <= 1, 'Reload preserves the inherited position.');
                    await page.goBack();
                    await waitForBreadcrumbSettled(page);
                    assert.ok(Math.abs((await readCanvas(page)).canvasOffsetX - before.canvasOffsetX) <= 1, 'Back preserves the original source position.');
                    await page.goForward();
                    await waitForBreadcrumbSettled(page);
                    assert.ok(Math.abs((await readCanvas(page)).canvasOffsetX - after.canvasOffsetX) <= 1, 'Forward restores the product position.');
                    cases.push({ width, source, before, after, name, selected });
                }
            }
            return { cases };
        }
    })),
    {
        id: 'canvas-mobile-touch-navigation',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: viewports[0],
        isMobile: true,
        hasTouch: true,
        title: 'Mobile Viewport and Real Touch Drag Between Reading and Root Entries',
        async run({ page, context, baseUrl, artifactDir }) {
            await page.addInitScript(() => {
                window.__canvasTouchStarts = [];
                document.addEventListener('touchstart', event => {
                    window.__canvasTouchStarts.push({
                        trusted: event.isTrusted,
                        region: event.target.closest('[data-root-navigation]') ? 'root'
                            : event.target.closest('.prose') ? 'prose'
                                : event.target.closest('.document-aside') ? 'aside' : 'column'
                    });
                }, { passive: true });
            });
            const url = `${baseUrl}/zh/p/wsl-guide/?from=all`;
            await gotoAndWait(page, url);
            await waitForBreadcrumbSettled(page);
            await nextPaint(page);
            const initial = await readCanvas(page);
            assert.equal(initial.canvasOffsetX, 0, 'A direct visit starts at the canvas origin without revealing main automatically.');
            assert.ok(await page.evaluate(() => navigator.maxTouchPoints > 0));
            const cdp = await context.newCDPSession(page);
            const canvasPosition = () => page.evaluate(() => ({
                x: window.visualViewport?.pageLeft ?? scrollX,
                y: document.querySelector('.page-content').scrollTop
            }));
            const drags = [];
            const swipe = async (x, distance, distanceY = 0) => {
                const before = await canvasPosition();
                const point = (currentX, currentY = 180) => ({ x: currentX, y: currentY, id: 1 });
                await cdp.send('Input.dispatchTouchEvent', {
                    type: 'touchStart', touchPoints: [point(x)]
                });
                const steps = Math.ceil(Math.max(Math.abs(distance), Math.abs(distanceY)) / 20);
                for (let step = 1; step <= steps; step++) {
                    await page.waitForTimeout(40);
                    await cdp.send('Input.dispatchTouchEvent', {
                        type: 'touchMove', touchPoints: [point(x + distance * step / steps, 180 + distanceY * step / steps)]
                    });
                }
                // Release after a stationary moment so inertia does not obscure the final position.
                await page.waitForTimeout(120);
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                await nextPaint(page);
                const after = await canvasPosition();
                if (!distanceY) assert.equal(after.y, before.y, 'Horizontal touch input preserves the vertical reading position.');
                drags.push({ x, distance, distanceY, before, after });
            };
            for (let attempt = 0; attempt < 5 && (await canvasPosition()).x > 0; attempt++) {
                await swipe(50, 260);
            }
            const roots = await readCanvas(page);
            assert.equal(roots.canvasOffsetX, 0, 'Dragging right on prose and the adjacent list reveals the canvas start.');
            assert.ok(roots.nav.x >= 0 && roots.nav.right <= 390 && roots.rootCount === 14);
            await page.screenshot({ path: path.join(artifactDir, 'mobile-root-entries.png') });

            await swipe(210, -180);
            assert.ok((await canvasPosition()).x > 0, 'A leftward drag on a root row moves the document canvas.');
            for (let attempt = 0; attempt < 4 && (await readCanvas(page)).main.x > 16; attempt++) {
                // With the aside collapsed, reaching the canvas end aligns main.
                await swipe(350, -Math.min(300, (await readCanvas(page)).main.x));
            }
            const final = await readCanvas(page);
            assert.ok(final.main.x >= 0 && final.main.x <= 16 && final.main.right <= final.viewport + 1,
                'Dragging left returns to the main content: ' + JSON.stringify(final));
            assert.equal(page.url(), url, 'Dragging a navigation link must not activate it.');
            await swipe(50, 120);
            await swipe(300, -120);
            await openDocumentAside(page, true);
            const asideBounds = () => page.locator('.document-aside').evaluate(aside => {
                const box = aside.getBoundingClientRect();
                const viewport = window.visualViewport;
                return { x: box.x - (viewport?.offsetLeft || 0), right: box.right - (viewport?.offsetLeft || 0) };
            });
            for (let attempt = 0; attempt < 4 && (await asideBounds()).right > 390; attempt++) {
                await swipe(350, -Math.min(300, Math.max(40, (await asideBounds()).right - 390)));
            }
            const aside = await asideBounds();
            assert(aside.x >= 0 && aside.right <= 390, 'Touch dragging reveals the entire metadata column.');
            await page.screenshot({ path: path.join(artifactDir, 'mobile-metadata.png') });
            for (let attempt = 0; attempt < 4 && (await readCanvas(page)).main.x < 0; attempt++) {
                await swipe(300, Math.min(300, 16 - (await readCanvas(page)).main.x));
            }
            const returnedMain = await readCanvas(page);
            assert(returnedMain.main.x >= 0 && returnedMain.main.right <= 391,
                'A rightward drag from metadata restores the reading column.');
            const events = await page.evaluate(() => window.__canvasTouchStarts);
            assert.ok(events.some(event => event.trusted && event.region === 'prose'));
            assert.ok(events.some(event => event.trusted && event.region === 'root'));
            assert.ok(events.some(event => event.trusted && event.region === 'aside'));
            assert.ok(events.every(event => event.trusted));
            await page.screenshot({ path: path.join(artifactDir, 'mobile-reading-restored.png') });

            await swipe(210, 0, -120);
            await swipe(50, 180);
            const historyPosition = await canvasPosition();
            assert.ok(historyPosition.x > 0 && historyPosition.x < final.canvasOffsetX && historyPosition.y > 0,
                'The history fixture preserves a user-chosen position on both axes.');
            await gotoAndWait(page, `${baseUrl}/zh/appearance/`);
            await page.goBack();
            await waitForBreadcrumbSettled(page);
            await page.waitForFunction(({ x }) => (
                Math.abs((window.visualViewport?.pageLeft ?? scrollX) - x) <= 1
            ), historyPosition, { timeout: 5000 });
            const restoredHistoryPosition = await canvasPosition();
            return { initial, roots, final, aside, returnedMain, drags, events, historyPosition, restoredHistoryPosition };
        }
    },
    {
        id: 'canvas-shared-layout-all-widths',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'One Horizontal Column Layout at 390, 1024 and 1440 Pixels',
        async run({ page, baseUrl, artifactDir }) {
            const results = [];
            for (const viewport of viewports) {
                await page.setViewportSize(viewport);
                for (const [name, target] of [
                    ['article', articlePath], ['collection', '/zh/all/'], ['system', '/zh/updates/']
                ]) {
                    await gotoAndWait(page, baseUrl + target);
                    await waitForBreadcrumbSettled(page);
                    await nextPaint(page);
                    const state = await readCanvas(page);
                    const detail = JSON.stringify({ viewport, name, state });
                    assert.equal(state.rootCount, 14, detail);
                    assert.equal(state.obsoleteControls, 0, detail);
                    assert.equal(state.plainColumns, true, detail);
                    assert.ok(Math.abs(state.nav.width - 225) <= 1, detail);
                    assert.ok(state.columns.every(column => Math.abs(column.width - 225) <= 1), detail);
                    assert.ok(state.columnLinks.every(count => count > 0), detail);
                    assert.ok(state.columns.every(column => Math.abs(column.y - state.main.y) <= 1), detail);
                    assert.ok(Math.abs(state.nav.y - state.main.y) <= 1, detail);
                    assert.equal(state.canvasOffsetX, 0, 'Direct visits preserve the canvas origin: ' + detail);
                    if (name !== 'collection') assert.ok(state.main.width <= state.viewport + 1, detail);
                    if (viewport.width === 390) {
                        assert.ok(state.scrollWidth > state.viewport, detail);
                        assert.ok(state.nav.x >= 0 && state.nav.right <= state.viewport, detail);
                    }
                    if (state.prose) {
                        assert.ok(state.prose.width <= state.viewport && state.prose.width >= Math.min(350, state.viewport - 32), detail);
                        assert.ok(state.proseOverflow <= 1, 'Wide code, tables and images must not expand the prose track: ' + detail);
                    }
                    assert.ok(state.footerInRail, detail);
                    if (state.footer) {
                        assert.ok(Math.abs(state.footer.x - state.nav.x) <= 1, detail);
                        assert.ok(state.footer.y >= state.nav.y + state.nav.height, detail);
                    }
                    if (name === 'article') {
                        assert.ok(state.columns.length >= 5, detail);
                        await page.screenshot({ path: path.join(artifactDir, `article-${viewport.width}.png`) });
                    }
                    await page.evaluate(() => scrollTo({ left: 0, top: 0, behavior: 'instant' }));
                    await nextPaint(page);
                    const rootBounds = await page.locator('[data-root-navigation]').boundingBox();
                    assert.ok(rootBounds.x >= 0 && rootBounds.x + rootBounds.width <= viewport.width,
                        'Scrolling left must reveal the complete visible navigation list.');
                    results.push({ viewport, name, ...state });
                }
            }
            const articleCounts = results.filter(result => result.name === 'article').map(result => result.columns.length);
            assert.ok(articleCounts.every(count => count === articleCounts[0]), 'The same content exposes the same columns at every width.');
            return { cases: results };
        }
    },
    {
        id: 'canvas-history-scroll-restoration',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: { width: 390, height: 300 },
        title: 'History Navigation Preserves the Native Horizontal Canvas Position',
        async run({ page, baseUrl }) {
            await gotoAndWait(page, `${baseUrl}/zh/p/ssh-remote-kit-windows/?from=all`);
            await waitForBreadcrumbSettled(page);
            await page.evaluate(() => { scrollTo(241, 0); document.querySelector('.page-content').scrollTop = 570; });
            await nextPaint(page);
            const first = await position(page);
            assert.ok(first.x > 0, 'The history fixture must exercise a panned canvas.');
            await gotoAndWait(page, `${baseUrl}/zh/p/xvenv/?from=all`);
            await waitForBreadcrumbSettled(page);
            await page.evaluate(() => { scrollTo(37, 0); document.querySelector('.page-content').scrollTop = 310; });
            await nextPaint(page);
            const second = await position(page);
            await page.goBack();
            await waitForBreadcrumbSettled(page);
            await assertPosition(page, first, 'Back must preserve the native horizontal restoration.');
            await page.goForward();
            await waitForBreadcrumbSettled(page);
            await assertPosition(page, second, 'Forward must restore the second reading position.');
            await page.reload();
            await waitForBreadcrumbSettled(page);
            await assertPosition(page, second, 'Reload must not run the new-navigation positioning again.');
            assert.equal(await page.evaluate(() => history.scrollRestoration), 'auto');
            assert.equal(await page.evaluate(() => !!history.state?.banyanColumnScroll
                || Object.keys(sessionStorage).some(key => key.startsWith('banyan:column-scroll:'))), false,
            'Column positions must not be stored by the site.');

            const sort = page.locator('.slot-breadcrumb [data-collection-sort-toggle="true"]').first();
            await sort.scrollIntoViewIfNeeded();
            await sort.focus();
            await nextPaint(page);
            const beforeSort = await position(page);
            const beforeUrl = page.url();
            await page.keyboard.press('Enter');
            await page.waitForURL(url => url.href !== beforeUrl);
            await waitForBreadcrumbSettled(page);
            await assertPosition(page, beforeSort, 'Sorting a visible column must not jump back to main.');
            await gotoAndWait(page, `${baseUrl}/zh/p/ssh-remote-kit-windows/?from=all`);
            assert.equal(await page.locator('.page-content').evaluate(column => column.scrollTop), 0,
                'A new visit to the same URL starts at the top.');
            return { first, second, beforeSort };
        }
    },
    {
        id: 'canvas-anchors',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: viewports[0],
        title: 'Native Anchors and Skip Link',
        async run({ page, baseUrl }) {
            await gotoAndWait(page, baseUrl + articlePath);
            const headingId = await page.locator('.prose :is(h2, h3)[id]').first().getAttribute('id');
            assert.ok(headingId, 'The real article must expose a native heading anchor.');
            await gotoAndWait(page, baseUrl + articlePath + '#' + encodeURIComponent(headingId));
            await nextPaint(page);
            const heading = await page.locator('[id]').evaluateAll((nodes, id) => {
                const box = nodes.find(node => node.id === id).getBoundingClientRect();
                return { x: box.x, y: box.y, width: box.width };
            }, headingId);
            assert.ok(heading.x >= -1 && heading.x < 390 && heading.y >= -1 && heading.y < 900,
                'A direct fragment keeps the native target visible: ' + JSON.stringify(heading));

            await page.locator('.skip-link').focus();
            const beforeSkip = await page.locator('.page-content').evaluate(column => column.scrollTop);
            await page.keyboard.press('Enter');
            await page.waitForURL(url => url.hash === '#main');
            await nextPaint(page);
            const main = await page.locator('#main').boundingBox();
            assert.ok(main.x >= -1 && main.x < 390 && main.y >= -1 && main.y < 900,
                'Skip to content must bring the actual main column into view.');
            const afterSkip = await page.locator('.page-content').evaluate(column => column.scrollTop);
            assert(beforeSkip > afterSkip);
            return { headingId, heading };
        }
    },
    {
        id: 'canvas-keyboard-order',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: viewports[0],
        title: 'Column Keyboard Order',
        async run({ page, baseUrl }) {

            // Keyboard traversal leaves the complete root list for the next column.
            await gotoAndWait(page, `${baseUrl}/zh/updates/`);
            const order = await page.evaluate(() => {
                const rail = document.querySelector('.page-rail');
                const nav = rail.querySelector('[data-root-navigation]');
                const nextColumn = document.querySelector('.slot-breadcrumb') || document.querySelector('#main');
                const links = [...nav.querySelectorAll('a[href]')];
                links.at(-1).focus();
                return {
                    count: links.length,
                    before: !!(nav.compareDocumentPosition(nextColumn) & Node.DOCUMENT_POSITION_FOLLOWING),
                    focused: nav.contains(document.activeElement)
                };
            });
            assert.ok(order.count && order.before && order.focused, 'Root navigation stays in the first column in both DOM and visual order.');
            await page.keyboard.press('Tab');
            assert.equal(await page.evaluate(() => !!document.activeElement.closest('.slot-breadcrumb, #main')), true,
                'Tab after the final root link proceeds to the next visible column.');
            return { order };
        }
    },
    {
        id: 'canvas-first-frame-slow-runtime',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Source Columns Reserve Stable Geometry Before Slow Runtime Loads',
        async run({ page, baseUrl }) {
            await page.addInitScript(recordFirstMainLayoutScript());
            await page.route('**/js/**/*.js', async route => {
                await new Promise(resolve => setTimeout(resolve, 650));
                await route.continue();
            });
            const cases = [];
            for (const viewport of [viewports[0], viewports[2]]) {
                await page.setViewportSize(viewport);
                await gotoAndWait(page, baseUrl + articlePath);
                const first = await readFirstMainLayout(page);
                await waitForBreadcrumbSettled(page);
                await nextPaint(page);
                const final = await readCanvas(page);
                assert.ok(first.entryPending,
                    'The first parsed main must be captured before the source runtime settles.');
                assert.equal(first.breadcrumbColumnCount, final.columns.length);
                assert.ok(Math.abs(first.mainInlineStart - final.mainDocumentX) <= 1,
                    'Source resolution must not move the main track even when runtime scripts arrive late.');
                assert.equal(final.canvasOffsetX, 0, 'Slow source rendering must not reveal main or change the canvas origin.');
                cases.push({ viewport, first, final });
            }
            return { cases };
        }
    }
];
