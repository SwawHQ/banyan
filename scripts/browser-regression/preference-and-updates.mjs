import assert from 'node:assert/strict';
import path from 'node:path';
import { gotoAndWait, waitForBreadcrumbSettled, waitForServiceWorkerActive, waitForUpdateReady } from './helpers.mjs';
import { languageReturnScenarios } from './language-return.mjs';

const preferencePage = '.slot-main';
const updatePanel = '[data-site-update-panel]';

export const preferenceAndUpdateScenarios = [
    ...languageReturnScenarios,
    ...[
        { locale: 'zh-CN', href: '/all/', language: 'en' },
        { locale: 'en-US', href: '/zh/all/', language: 'zh' }
    ].map(({ locale, href, language }) => ({
        id: `language-no-recommendation-${locale}`,
        kind: 'single',
        serviceWorkers: 'block',
        locale,
        title: `Fresh Visit Keeps Explicit Language (${locale})`,
        async run({ page, baseUrl, dialogs }) {
            await gotoAndWait(page, baseUrl + href);
            assert.equal(await page.evaluate(() => localStorage.length), 0, 'No preference is seeded to suppress a recommendation.');
            // Wait beyond the retired 800 ms recommendation delay without any user interaction.
            await page.waitForTimeout(1200);
            assert.equal(dialogs.length, 0, 'A browser-language mismatch must not prompt or navigate.');
            assert.equal(page.url(), baseUrl + href);
            assert.equal(await page.locator('html').getAttribute('lang'), language);
            await page.reload();
            await page.waitForTimeout(1200);
            assert.equal(dialogs.length, 0);
            assert.equal(page.url(), baseUrl + href);
            return { message: 'Fresh visits and reloads keep the URL language without a recommendation dialog.' };
        }
    })),
    {
        id: 'powered-by-overview',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: { width: 1024, height: 700 },
        title: 'Powered by Overview with Inline PWA Status',
        async run({ page, baseUrl, artifactDir, context }) {
            const rowPaths = selector => page.locator(selector).evaluateAll(nodes => nodes.map(node => new URL(node.href).pathname));
            const assertNewTabs = async (links) => {
                const originalUrl = page.url();
                for (const link of await links.all()) {
                    assert.equal(await link.getAttribute('target'), '_blank');
                    const rel = (await link.getAttribute('rel')).split(/\s+/);
                    assert(rel.includes('noopener') && rel.includes('noreferrer'));
                    const destination = await link.evaluate(node => node.href);
                    // Verify native tab navigation without depending on external sites or the XML viewer.
                    const destinationResponse = route => route.fulfill({status: 200, contentType: 'text/plain', body: 'Link destination'});
                    await context.route(destination, destinationResponse);
                    try {
                        const [opened] = await Promise.all([context.waitForEvent('page'), link.click()]);
                        try {
                            await opened.waitForLoadState('domcontentloaded');
                            assert.equal(opened.url(), destination);
                            assert.equal(await opened.evaluate(() => window.opener), null);
                            assert.equal(page.url(), originalUrl, 'The information page stays open in its original tab.');
                        } finally { await opened.close(); }
                    } finally { await context.unroute(destination, destinationResponse); }
                }
            };
            for (const prefix of ['', '/zh', '/zh-tw']) {
                await gotoAndWait(page, `${baseUrl}${prefix}/`);
                const feedHref = await page.locator('head link[rel="alternate"][type="application/rss+xml"]').getAttribute('href');
                const homeEntry = `[data-root-href="${prefix}/"]`;
                const brand = await page.locator(`${homeEntry} .collection-item-title`).textContent();
                assert.equal(await page.locator('footer, .slot-footer').count(), 0);
                assert.equal(await page.locator('[data-root-href][target="_blank"]').count(), 0, 'First-column entries open in the current tab.');
                assert.equal(await page.locator(`${homeEntry}.is-current`).count(), 1);
                assert.equal(await page.locator(`${homeEntry} .icon--text`).textContent(), '©');
                assert.equal(await page.locator(homeEntry).getAttribute('href'), `${prefix}/`);
                await gotoAndWait(page, `${baseUrl}${prefix}/powered-by/`);
                assert.equal(await page.locator('.slot-main h1').textContent(), 'Powered by');
                assert.equal(await page.locator('.slot-main [data-sortable]').count(), 0);
                assert.equal(await page.locator('[data-site-update-panel]').count(), 1);
                assert.equal(await page.locator('[data-site-update-action]').count(), 1);
                assert.equal(await page.locator('.slot-breadcrumb .collection-item-link').count(), 0);
                assert.equal(await page.locator(`[data-root-href="${prefix}/powered-by/"] use`).getAttribute('href'), '#icon-code');
                assert.equal(await page.locator('#icon-code path').count(), 1, 'The code symbol is included in the SVG sprite.');
                const prose = page.locator('.slot-main .prose');
                assert.equal(await prose.locator('h2').count(), 4);
                assert.equal(await prose.locator('a[href="https://github.com/SwawHQ/banyan/blob/HEAD/CHANGELOG.md"]').count(), 1);
                assert.equal(await prose.locator('a[href="https://gohugo.io/news/"]').count(), 1);
                await assertNewTabs(prose.locator('a[target="_blank"]'));
                const aboutIcon = page.locator(`[data-root-href="${prefix}/about/"] img.icon--image`);
                const aboutIconHref = await aboutIcon.getAttribute('src');
                assert.equal(aboutIconHref, await page.locator('head link[rel="icon"][type="image/svg+xml"]').getAttribute('href'), 'The About entry reuses the published site favicon.');
                await aboutIcon.evaluate(image => image.decode());
                assert.deepEqual(await aboutIcon.evaluate(image => ({width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height})), {width: 15, height: 15});
                assert.equal(await page.locator('footer, .slot-footer').count(), 0, 'The homepage entry replaces the footer.');
                assert.equal(await page.locator(`${homeEntry} .collection-item-title`).textContent(), brand);
                assert.equal(await page.locator(`${homeEntry}.is-current`).count(), 0);
                assert.equal(await page.locator(homeEntry).getAttribute('href'), `${prefix}/`);
                const filingEntry = page.locator(`[data-root-href="${prefix}/icp/"]`);
                assert.equal(await filingEntry.locator('.icon--text').textContent(), '粤');
                assert.equal(await filingEntry.locator('img').count(), 0);
                assert.equal(await filingEntry.locator('.collection-item-title').textContent(), 'ICP备2024338434号');
                assert.deepEqual((await rowPaths('[data-root-href]')).slice(-2), [`${prefix}/icp/`, `${prefix}/`]);
                await filingEntry.click();
                await waitForBreadcrumbSettled(page);
                assert.equal(await filingEntry.getAttribute('aria-current'), 'page');
                const filingEmblem = page.locator('.slot-main .prose img');
                assert.match(await filingEmblem.getAttribute('src'), /^\/media\/content\/icp\/0\.[a-f0-9]{64}\.webp$/);
                await filingEmblem.evaluate(image => image.decode());
                assert.match(await page.locator('.slot-main .prose').textContent(), /粤ICP备2024338434号/);
                assert.equal(await page.locator('.slot-main .prose a[href="https://beian.miit.gov.cn/"]').filter({hasText: /^\s*粤ICP备2024338434号\s*$/}).count(), 1);
                const filingLinks = page.locator('.slot-main .prose a[href="https://beian.miit.gov.cn/"]');
                assert.equal(await filingLinks.count(), 2);
                await assertNewTabs(filingLinks);
                await page.goBack();
                await page.waitForURL(`${baseUrl}${prefix}/powered-by/`);
                await waitForBreadcrumbSettled(page);

                for (const name of ['about', 'wechat', 'github', 'rss']) {
                    const entry = page.locator(`[data-root-href="${prefix}/${name}/"]`);
                    if (['wechat', 'github', 'rss'].includes(name)) assert.equal(await entry.locator('use').getAttribute('href'), `#icon-${name}`);
                    await entry.click();
                    await waitForBreadcrumbSettled(page);
                    const assertRootPage = async () => {
                        assert.equal(new URL(page.url()).pathname, `${prefix}/${name}/`);
                        assert.equal(new URL(page.url()).search, '', 'An ordinary root link carries no directory source.');
                        assert.deepEqual(await rowPaths('[data-root-href].is-current'), [`${prefix}/${name}/`]);
                        assert.equal(await page.locator('[data-root-href]').count(), 14);
                        assert.equal(await page.locator(`[data-root-href="${prefix}/powered-by/"] use`).getAttribute('href'), '#icon-code');
                        assert.equal(await page.locator(`[data-root-href="${prefix}/about/"] img.icon--image`).getAttribute('src'), aboutIconHref);
                        assert.equal(await page.locator('.slot-breadcrumb .collection-item-link').count(), 0, 'Promoted pages do not retain a site directory column.');
                    };
                    await assertRootPage();
                    if (name === 'github') {
                        const accountLinks = page.locator('.slot-main .prose a[href="https://github.com/SwawHQ"]');
                        assert.equal(await accountLinks.count(), 2, 'Both the avatar and visible URL link to the organization.');
                        await assertNewTabs(accountLinks);
                        const avatar = accountLinks.locator('img');
                        assert.equal(await avatar.count(), 1);
                        assert.equal(await avatar.getAttribute('src'), await page.locator('head link[rel="icon"][type="image/svg+xml"]').getAttribute('href'), 'The GitHub avatar reuses the published favicon resource.');
                        await avatar.evaluate(image => image.decode());
                        assert.equal(await avatar.evaluate(image => getComputedStyle(image).filter), 'none', 'A shared resource keeps its original colors without monochrome opt-in.');
                        assert.equal(await avatar.getAttribute('height'), '48');
                        assert.deepEqual(await avatar.evaluate(image => ({width: image.getBoundingClientRect().width, naturalRatio: image.naturalWidth / image.naturalHeight})), {width: 64, naturalRatio: 4 / 3});
                        assert.equal(await page.locator('.slot-main .prose table').count(), 0);
                        const founderLinks = page.locator('.slot-main .prose a[href="https://github.com/bornwhy"]');
                        assert.equal(await founderLinks.count(), 2, 'The founder has a linked avatar and visible URL.');
                        await assertNewTabs(founderLinks);
                        const founderAvatar = founderLinks.locator('img');
                        await founderAvatar.evaluate(image => image.decode());
                        assert.equal(await founderAvatar.getAttribute('height'), '64');
                        assert.deepEqual(await founderAvatar.evaluate(image => ({width: image.getBoundingClientRect().width, naturalRatio: image.naturalWidth / image.naturalHeight})), {width: 64, naturalRatio: 1});
                        assert.deepEqual(await page.locator('.slot-main .prose a').evaluateAll(links => [...new Set(links.map(link => link.href))]), ['https://github.com/bornwhy', 'https://github.com/SwawHQ']);
                        assert.equal(await page.locator('.slot-main .prose img').count(), 2);
                    } else if (name === 'wechat') {
                        const qrImages = page.locator('.slot-main .prose img');
                        assert.equal(await qrImages.count(), 2);
                        await qrImages.evaluateAll(images => Promise.all(images.map(image => image.decode())));
                    } else if (name === 'rss') {
                        const feed = page.locator(`.slot-main .prose a[href="${feedHref}"]`);
                        assert.equal(await feed.count(), 1, 'RSS uses the actual language homepage output.');
                        await assertNewTabs(feed);
                        assert.equal(new URL((await feed.textContent()).trim()).pathname, new URL(feedHref, baseUrl).pathname, 'The visible subscription address can be copied into a reader.');
                        const response = await page.request.get(new URL(feedHref, baseUrl).href);
                        assert.equal(response.status(), 200);
                        const xml = await response.text();
                        assert.match(xml, /<rss\b/);
                        assert.match(xml, /<item>/);
                        assert(!/\/(?:about|updates|wechat|rss|github|icp)\//.test(xml), 'Local information pages do not become feed articles.');
                    } else if (name === 'about') {
                        assert.equal(await page.locator('.slot-main .prose a[href="https://github.com/SwawHQ"]').count(), 1);
                        assert.equal(await page.locator('.slot-main .prose a[href="https://github.com/bornwhy"]').count(), 1);
                        assert.equal(await page.locator('.slot-main .prose a[href="https://github.com/swawai"]').count(), 0);
                    }
                    if (prefix === '/zh') await page.screenshot({ path: path.join(artifactDir, `root-${name}.png`) });
                    await page.reload();
                    await waitForBreadcrumbSettled(page);
                    await assertRootPage();
                    await page.goBack();
                    await page.waitForURL(`${baseUrl}${prefix}/powered-by/`);
                    await waitForBreadcrumbSettled(page);
                    await page.goForward();
                    await waitForBreadcrumbSettled(page);
                    await assertRootPage();
                    await page.goBack();
                    await page.waitForURL(`${baseUrl}${prefix}/powered-by/`);
                    await waitForBreadcrumbSettled(page);
                }

                const assertOverview = async () => {
                    assert.equal(new URL(page.url()).pathname, `${prefix}/powered-by/`);
                    assert.equal(await page.locator(`[data-root-href="${prefix}/powered-by/"].is-current`).count(), 1);
                    assert.equal(await page.locator('[data-site-update-panel]').count(), 1);
                    assert.equal(await page.locator('[data-site-update-version]').count(), 1, 'Build time appears only once.');
                    assert.equal(await page.locator('[data-site-update-panel] time').count(), 0);
                    assert.equal(await page.locator('.slot-breadcrumb .collection-item-link').count(), 0);
                    assert.equal(await page.locator('a[href*="/powered-by/pwa/"]').count(), 0);
                    assert.equal(await page.locator('[data-pwa-controlled]').count(), 1);
                    assert.equal(await page.locator('[data-site-update-action="check"]').count(), 1);
                };
                await assertOverview();
                await page.reload();
                await assertOverview();
                await page.locator(`[data-root-href="${prefix}/about/"]`).click();
                await page.goBack();
                await page.waitForURL(`${baseUrl}${prefix}/powered-by/`);
                await assertOverview();
                await page.locator('[data-site-update-panel]').scrollIntoViewIfNeeded();
                if (prefix === '/zh') await page.screenshot({path: path.join(artifactDir, 'pwa-inline-desktop.png')});
                if (prefix === '/zh') {
                    await page.screenshot({path: path.join(artifactDir, 'powered-by-desktop.png')});
                    await page.setViewportSize({width: 390, height: 844});
                    await gotoAndWait(page, baseUrl + '/zh/about/');
                    await page.locator('[data-root-href="/zh/powered-by/"]').click();
                    await waitForBreadcrumbSettled(page);
                    await page.locator('.slot-main h1').scrollIntoViewIfNeeded();
                    await page.screenshot({path: path.join(artifactDir, 'powered-by-mobile.png')});
                    await page.locator('[data-site-update-panel]').scrollIntoViewIfNeeded();
                    await page.screenshot({path: path.join(artifactDir, 'pwa-inline-mobile.png')});
                    await page.setViewportSize({width: 1024, height: 700});
                }
            }
            return { message: 'The multilingual overview, SVG icon, source/release links and inline PWA panel work across reload and history; existing root information pages remain intact.' };
        }
    },
    {
        id: 'preference-return-live-navigation-state',
        kind: 'single',
        serviceWorkers: 'block',
        viewport: { width: 1440, height: 900 },
        title: 'Ordinary Preference Links and Native Back Navigation',
        async run({ page, baseUrl, context }) {
            const entry = name => page.locator('[data-root-href="/zh/' + name + '/"]');
            const back = () => page.locator('[data-page-action="back"]').click();
            const assertCleanLinks = async () => {
                const links = await page.locator('[data-root-href]').evaluateAll(links => links.map(link => ({
                    href: new URL(link.href).pathname + new URL(link.href).search + new URL(link.href).hash,
                    root: link.dataset.rootHref
                })));
                assert.equal(links.length, 14);
                assert(links.every(link => link.href === link.root), 'All root entries retain their ordinary page URLs.');
            };
            await gotoAndWait(page, baseUrl + '/zh/all/');
            await page.locator('.slot-main [data-sort-field="name"]').click();
            await page.waitForURL(url => url.searchParams.get('sort') === 'name-asc');
            await page.evaluate(() => { location.hash = 'reading-position'; });
            await assertCleanLinks();
            const source = page.url();
            await entry('my').click();
            assert.equal(new URL(page.url()).search, '');
            await back();
            await page.waitForURL(source);
            await assertCleanLinks();

            // Opening a preference entry in a new tab carries no return context.
            const opened = context.waitForEvent('page');
            await entry('language').click({button: 'middle'});
            const popup = await opened;
            try {
                await popup.waitForLoadState('networkidle');
                assert.equal(new URL(popup.url()).pathname, '/zh/language/');
                assert.equal(new URL(popup.url()).search, '');
                assert.equal(await popup.evaluate(() => history.length), 1);
                await popup.locator('[data-language-choice="en"]').click();
                await popup.waitForURL(baseUrl + '/language/');
                await popup.locator('[data-language-choice="zh-tw"]').click();
                await popup.waitForURL(baseUrl + '/zh-tw/language/');
                assert.equal(await popup.evaluate(() => history.length), 1, 'Language choices do not create a previous page in a new tab.');
                await popup.locator('[data-page-action="back"]').click();
                await popup.waitForURL(baseUrl + '/zh-tw/');
            } finally { await popup.close(); }

            await gotoAndWait(page, baseUrl + '/zh/p/xvenv/?from=all');
            const beforeSort = page.url();
            await page.locator('.slot-breadcrumb [data-collection-sort-toggle="true"]').click();
            await page.waitForURL(url => url.href !== beforeSort);
            await page.evaluate(() => history.replaceState({ ...history.state, backMarker: true }, '', location.href));
            const article = page.url();
            await assertCleanLinks();
            for (const name of ['appearance', 'powered-by', 'language']) {
                await entry(name).click();
                await page.waitForURL(baseUrl + '/zh/' + name + '/');
                await assertCleanLinks();
            }
            await page.reload();
            for (const name of ['powered-by', 'appearance']) {
                if (name === 'appearance') {
                    assert.equal(await page.locator('[data-page-action="back"]').count(), 0, 'The ordinary updates list has no custom back control.');
                    await page.goBack();
                } else await back();
                await page.waitForURL(baseUrl + '/zh/' + name + '/');
            }
            await back();
            await page.waitForURL(article);
            assert.equal(await page.evaluate(() => history.state.backMarker), true);
            await page.goForward();
            await page.waitForURL(baseUrl + '/zh/appearance/');
            await back();
            await page.waitForURL(article);
            return {message: 'Clean root links, My back, new-tab home, one-step settings history and article sort/state restoration passed.'};
        }
    },
    {
        id: 'language-return',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Language Choices Replace the Settings History Entry',
        dialogPolicy: 'dismiss',
        async run({ page, baseUrl, dialogs, artifactDir }) {
            await gotoAndWait(page, baseUrl + '/zh/p/xvenv/?from=tools/free&sorts=_,name-asc#details');
            const article = page.url();
            await page.locator('[data-root-href="/zh/language/"]').click();
            const historyLength = await page.evaluate(() => history.length);
            const assertChoiceContract = async (selectedCode) => {
                const state = await page.evaluate(() => {
                    const list = document.querySelector('.slot-main [data-list-view]');
                    return {
                        view: list?.dataset.listView || '',
                        sortable: Boolean(list?.hasAttribute('data-sortable') || list?.querySelector('[data-sortable]')),
                        options: [...(list?.querySelectorAll('[data-language-choice]') || [])].map((option) => ({
                            code: option.dataset.languageChoice,
                            current: option.getAttribute('aria-current') || '',
                            iconHidden: option.querySelector('.collection-item-icon')?.getAttribute('aria-hidden') || '',
                            iconText: option.querySelector('.collection-item-icon--text')?.textContent?.trim() || '',
                            label: option.querySelector('.collection-item-title')?.textContent?.trim() || '',
                            left: option.querySelector('.collection-item-title')?.getBoundingClientRect().left || 0,
                            tagName: option.tagName
                        }))
                    };
                });
                assert.equal(state.view, 'choice');
                assert.equal(state.sortable, false);
                assert.deepEqual(state.options.map(({code, iconText}) => [code, iconText]), [
                    ['en', 'EN'], ['zh', '简'], ['zh-tw', '繁']
                ]);
                assert(state.options.every((option) => option.tagName === 'A' && option.iconHidden === 'true' && option.label));
                assert.equal(state.options.find((option) => option.code === selectedCode)?.current, 'page');
                for (const option of state.options) {
                    assert.equal(await page.getByRole('link', {name: option.label, exact: true}).count(), 1,
                        `Decorative marker must not change the accessible name for ${option.code}.`);
                }
                const titlePositions = state.options.map((option) => option.left);
                assert(Math.max(...titlePositions) - Math.min(...titlePositions) <= 1,
                    'Text and Unicode icon choices keep one aligned title column.');
            };
            await assertChoiceContract('zh');
            for (const [code, pathname] of [['en', '/language/'], ['zh-tw', '/zh-tw/language/'], ['zh', '/zh/language/']]) {
                const choice = page.locator('[data-language-choice="' + code + '"]');
                assert.equal(await choice.getAttribute('href'), pathname);
                await choice.click();
                await page.waitForURL(baseUrl + pathname);
                assert.equal(await page.locator('[data-language-choice="' + code + '"]').getAttribute('aria-current'), 'page');
                assert.equal(await page.evaluate(() => history.length), historyLength, 'Choosing a language replaces the current settings entry.');
                await assertChoiceContract(code);
            }
            await page.reload();
            await page.locator('[data-page-action="back"]').click();
            await page.waitForURL(article);
            await page.goForward();
            await page.waitForURL(baseUrl + '/zh/language/');
            await page.goBack();
            await page.waitForURL(article);
            assert.equal(await page.locator('html').getAttribute('lang'), 'zh', 'Returning keeps the chosen language.');

            // Unknown query parameters do not participate in settings navigation.
            await page.addInitScript(() => history.replaceState({ ...history.state, cleanupMarker: true }, '', location.href));
            for (const name of ['language', 'appearance', 'my', 'powered-by']) {
                await gotoAndWait(page, baseUrl + '/zh/' + name + '/?return=https%3A%2F%2Fexample.invalid%2F&probe=keep#anchor');
                assert.equal(new URL(page.url()).search, '?return=https%3A%2F%2Fexample.invalid%2F&probe=keep');
                assert.equal(new URL(page.url()).hash, '#anchor');
                assert.equal(await page.evaluate(() => history.state.cleanupMarker), true);
            }
            await gotoAndWait(page, baseUrl + '/zh/powered-by/?return=unused&probe=keep');
            assert.equal(new URL(page.url()).search, '?return=unused&probe=keep', 'Ordinary and settings pages both ignore unknown query parameters.');
            await gotoAndWait(page, baseUrl + '/language/?return=' + encodeURIComponent('/prefetchdebug/'));
            const dialogCount = dialogs.length;
            await page.locator('[data-language-choice="zh"]').click();
            await page.waitForURL(baseUrl + '/zh/language/');
            assert.equal(dialogs.length, dialogCount);
            await page.screenshot({path: path.join(artifactDir, 'language.png')});
            return {message: 'Three language choices share one history entry; button/browser back restores the article, forward restores the final language, and clean URLs/preference survive refresh.'};
        }
    },
    {
        id: 'appearance-preference',
        kind: 'single',
        serviceWorkers: 'block',
        title: 'Appearance Page and Global Preference',
        async run({ page, baseUrl, context, artifactDir }) {
            await page.emulateMedia({ colorScheme: 'light' });
            await gotoAndWait(page, baseUrl + '/zh/all/?sort=name-asc');
            await page.locator('[data-root-href="/zh/appearance/"]').click();
            await page.waitForURL(baseUrl + '/zh/appearance/');
            const assertAboutFilter = async () => {
                const icon = page.locator('[data-root-href="/zh/about/"] img.icon--image');
                assert.equal(await icon.evaluate(image => getComputedStyle(image).filter), 'none', 'The About logo retains its original colors in every theme.');
            };
            await assertAboutFilter();
            const choiceContract = await page.evaluate(() => {
                const list = document.querySelector('.slot-main [data-list-view]');
                return {
                    view: list?.dataset.listView || '',
                    sortable: Boolean(list?.hasAttribute('data-sortable') || list?.querySelector('[data-sortable]')),
                    options: [...(list?.querySelectorAll('[data-theme-choice]') || [])].map((option) => ({
                        choice: option.dataset.themeChoice,
                        pressed: option.getAttribute('aria-pressed'),
                        tagName: option.tagName
                    }))
                };
            });
            assert.equal(choiceContract.view, 'choice');
            assert.equal(choiceContract.sortable, false);
            assert.deepEqual(choiceContract.options.map((option) => option.choice), ['auto', 'light', 'dark']);
            assert(choiceContract.options.every((option) => option.tagName === 'BUTTON' && option.pressed !== null));
            await page.locator(`${preferencePage} [data-theme-choice="dark"]`).click();
            await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
            await assertAboutFilter();
            assert.equal(await page.evaluate(() => localStorage.getItem('theme-preference')), 'dark');
            await page.reload();
            await page.waitForSelector(`${preferencePage} [data-theme-choice="dark"].is-current[aria-pressed="true"]`);
            await page.locator(`${preferencePage} [data-theme-choice="light"]`).click();
            await page.waitForSelector(`${preferencePage} [data-theme-choice="light"].is-current`);
            await assertAboutFilter();
            await page.screenshot({ path: path.join(artifactDir, 'appearance-light.png'), animations: 'disabled' });

            assert.equal(await page.locator('.site-nav-utilities').count(), 0, 'The old settings buttons are removed.');
            await page.locator(`${preferencePage} [data-theme-choice="auto"]`).click();
            await page.emulateMedia({ colorScheme: 'dark' });
            await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
            await assertAboutFilter();
            await page.locator('[data-page-action="back"]').click();
            await page.waitForURL((url) => url.pathname === '/zh/all/');
            await page.emulateMedia({ colorScheme: 'light' });
            await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
            await assertAboutFilter();

            const other = await context.newPage();
            await other.goto(`${baseUrl}/zh/appearance/`);
            await other.locator(`${preferencePage} [data-theme-choice="dark"]`).click();
            await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
            await other.close();
            await page.goForward();
            await page.waitForSelector(`${preferencePage} [data-theme-choice="dark"].is-current`);
            await assertAboutFilter();
            await page.screenshot({ path: path.join(artifactDir, 'appearance-dark.png'), animations: 'disabled' });
            return { message: 'Appearance choices, refresh, return, OS changes and cross-tab sync passed.' };
        }
    },
    {
        id: 'sw-update-check',
        kind: 'upgrade',
        title: 'PWA Checks Never Activate or Reload; Link Navigation Applies Updates',
        dialogPolicy: 'dismiss',
        async run({ page, context, baseUrl, server, upgradePair, dialogs, artifactDir }) {
            assert.ok(upgradePair?.fromDir && upgradePair?.toDir, 'Two builds containing the preference and update pages are required.');
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, `${baseUrl}/zh/powered-by/`);
            await waitForServiceWorkerActive(page);
            await page.waitForSelector(`${updatePanel}[data-site-update-state]`);
            const versionBefore = await page.locator('[data-site-update-version]').getAttribute('title');
            const cacheKeysBefore = await page.evaluate(() => caches.keys());
            await context.setOffline(true);
            await page.locator('[data-site-update-action="check"]').click();
            await page.waitForSelector(`${updatePanel}[data-site-update-state="offline"]`);
            await context.setOffline(false);
            await page.locator('[data-site-update-action="check"]').click();
            await page.waitForSelector(`${updatePanel}[data-site-update-state="current"]`);

            server.setRoot(upgradePair.toDir);
            await page.locator('[data-site-update-action="check"]').click();
            await waitForUpdateReady(page);
            await page.waitForSelector(`${updatePanel}[data-site-update-state="ready"]`);
            assert.equal(dialogs.length, 0, 'The check page shows the update in place.');
            await page.screenshot({ path: path.join(artifactDir, 'site-update-ready.png') });
            const labelBefore = await page.locator('[data-site-update-action="check"]').textContent();
            let loads = 0;
            page.on('load', () => { loads++; });
            for (let i = 0; i < 2; i++) {
                await page.locator('[data-site-update-action="check"]').click();
                await page.waitForSelector(`${updatePanel}[data-site-update-state="ready"]`);
            }
            await page.waitForTimeout(4500);
            assert.equal(loads, 0, 'Repeated checks must not activate or reload, including after the activation timeout.');
            await waitForUpdateReady(page);
            assert.equal(await page.locator('[data-site-update-action="check"]').textContent(), labelBefore);
            assert.equal(await page.locator('[data-site-update-version]').getAttribute('title'), versionBefore);
            await page.locator('[data-root-href="/zh/about/"]').click();
            await page.waitForURL(baseUrl + '/zh/about/');
            await page.locator('[data-root-href="/zh/powered-by/"]').click();
            await page.waitForURL(baseUrl + '/zh/powered-by/');
            assert.notEqual(await page.locator('[data-site-update-version]').getAttribute('title'), versionBefore);
            await waitForServiceWorkerActive(page);
            assert.equal(new URL(page.url()).pathname, '/zh/powered-by/');
            assert.equal(await page.locator('[data-root-href="/zh/powered-by/"].is-current').count(), 1);
            await waitForBreadcrumbSettled(page);
            assert.equal(await page.locator('.slot-breadcrumb .collection-item-link').count(), 0, 'The overview needs no child navigation column.');
            const cacheKeysAfter = await page.evaluate(() => caches.keys());
            for (const key of cacheKeysBefore.filter((key) => key.startsWith('nav-html-'))) {
                assert.ok(!cacheKeysAfter.includes(key), `Old navigation cache remains: ${key}`);
            }
            const swResponse = await context.request.get(`${baseUrl}/sw.js`);
            assert.equal(swResponse.headers()['cache-control'], 'no-cache, max-age=0, must-revalidate');
            return { message: 'Offline/retry and repeated checks stay on the page; link navigation activates the update, clears old navigation caches and preserves sw.js headers.',
                details: { versionBefore, versionAfter: await page.locator('[data-site-update-version]').getAttribute('title'), cacheKeysBefore, cacheKeysAfter } };
        }
    }
];
