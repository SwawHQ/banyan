import {isFile,insideOutput,localReference} from '../../../_shared/output.mjs';
import {readPages,pageState,publishedURL} from '../../../_shared/html/read.mjs';
import {normalizeCssAssetFamilyKey,hasClassToken,extractStartTags,extractTagAttribute} from '../../../_shared/html/markup.mjs';

function inspectStylesheetContract(rows) {
    const issues = [];
    const pageStyleRefs = new Set();
    const proseStyleRefs = new Set();

    for (const row of rows) {
        for (const missingRef of row.missingStylesheetRefs || []) {
            issues.push(`Missing stylesheet asset ${missingRef} referenced by ${row.relativePath}`);
        }
        if (row.isRedirect) {
            if (row.stylesheetRefs.length > 0) {
                issues.push(`${row.relativePath}: redirect pages must not load stylesheets, got ${row.stylesheetRefs.join(', ')}.`);
            }
            continue;
        }

        const entries = row.stylesheetRefs.map((ref, index) => ({
            family: row.stylesheetFamilyKeys[index],
            ref,
            homeArt: row.stylesheetHomeArts[index],
        }));
        const refsFor = (family) => entries.filter((entry) => entry.family === family);
        const pageEntries = refsFor('/css/page.css');
        const proseEntries = refsFor('/css/prose.css');
        const allowedFamilies = new Set(['/css/page.css']);
        if (row.hasProse) {
            allowedFamilies.add('/css/prose.css');
        }
        if (row.homeArtCount > 1) {
            issues.push(`${row.relativePath}: page must declare one data-home-art-source body; found ${row.homeArtCount}.`);
        }
        for (const entry of entries.filter(entry => entry.homeArt && entry.homeArt !== row.homeArt)) {
            issues.push(`${row.relativePath}: stylesheet ${entry.ref} declares home art ${entry.homeArt}, expected ${row.homeArt || '<none>'}.`);
        }
        const unexpectedEntries = entries.filter(entry => (
            !allowedFamilies.has(entry.family)
            && (!row.homeArt || entry.homeArt !== row.homeArt)
        ));
        if (new Set(row.stylesheetRefs).size !== row.stylesheetRefs.length) {
            issues.push(`${row.relativePath}: stylesheet references must be unique.`);
        }

        if (pageEntries.length !== 1 || entries[0]?.family !== '/css/page.css') {
            issues.push(`${row.relativePath}: expected one leading page.css stylesheet, got ${row.stylesheetRefs.join(', ') || '<none>'}.`);
        } else {
            pageStyleRefs.add(pageEntries[0].ref);
        }
        if (unexpectedEntries.length > 0) {
            issues.push(`${row.relativePath}: unexpected stylesheet families: ${unexpectedEntries.map((entry) => entry.ref).join(', ')}.`);
        }

        const expectedProseCount = row.hasProse ? 1 : 0;
        if (proseEntries.length !== expectedProseCount) {
            issues.push(`${row.relativePath}: prose=${row.hasProse} requires ${expectedProseCount} prose.css reference, got ${proseEntries.length}.`);
        }
        for (const entry of proseEntries) {
            proseStyleRefs.add(entry.ref);
        }

    }

    // Each configured palette has its own Concat target and one content fingerprint.
    const pagePaletteTargets = new Set([...pageStyleRefs].map(ref =>
        ref.replace(/\.(?:min\.)?[0-9a-f]{16,}\.css$/i, '.css')));
    if (pageStyleRefs.size === 0 || pagePaletteTargets.size !== pageStyleRefs.size) {
        issues.push(`Rendered pages must share one page.css URL per palette; found ${[...pageStyleRefs].join(', ') || '<none>'}.`);
    }
    if (rows.some(row => row.hasProse) && proseStyleRefs.size !== 1) {
        issues.push(`All prose pages must share one prose.css URL; found ${[...proseStyleRefs].join(', ') || '<none>'}.`);
    }

    const prefetchDebugRows = rows.filter(row => row.isPrefetchDebug);
    for (const row of prefetchDebugRows) {
        if (!row.hasProse || !row.stylesheetFamilyKeys.includes('/css/prose.css')) {
            issues.push(`${row.relativePath}: template-rendered <pre> blocks must load prose.css.`);
        }
    }

    return {
        issues,
        pageStyleRefs: [...pageStyleRefs],
        proseStyleRefs: [...proseStyleRefs],
    };
}

export async function inspect(directory) {
  const {root,pages} = await readPages(directory), siteURL = await publishedURL(root);
  const rows = await Promise.all(pages.map(async page => {
    const stylesheets = extractStartTags(page.text,'link').filter(tag => extractTagAttribute(tag,'rel').toLowerCase().split(/\s+/).includes('stylesheet'))
      .map(tag => ({ref:localReference(extractTagAttribute(tag,'href').trim(),{siteURL,page:page.relativePath}),homeArt:extractTagAttribute(tag,'data-home-art')}))
      .filter(sheet => sheet.ref);
    const refs = stylesheets.map(sheet => '/' + sheet.ref);
    const homeArts = extractStartTags(page.text,'body').map(tag => extractTagAttribute(tag,'data-home-art-source')).filter(Boolean);
    const missing = [];
    for (const ref of refs) if (!await isFile(insideOutput(root,ref.slice(1)))) missing.push(ref);
    return {...pageState(page),stylesheetRefs:refs,stylesheetFamilyKeys:refs.map(normalizeCssAssetFamilyKey),
      stylesheetHomeArts:stylesheets.map(sheet => sheet.homeArt),homeArt:homeArts.length===1?homeArts[0]:'',homeArtCount:homeArts.length,
      hasProse:hasClassToken(page.text,'prose'),
      isPrefetchDebug:extractStartTags(page.text,'body').some(tag => /(?:^|\s)data-prefetch-debug(?:\s|=|>)/i.test(tag)),
      missingStylesheetRefs:missing};
  }));
  return inspectStylesheetContract(rows);
}
