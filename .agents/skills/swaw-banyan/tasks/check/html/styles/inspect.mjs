import {isFile,insideOutput,localReference} from '../../../_shared/output.mjs';
import {readPages,pageState,publishedURL} from '../../../_shared/html/read.mjs';
import {extractStylesheetHrefs,normalizeCssAssetFamilyKey,hasClassToken} from '../../../_shared/html/markup.mjs';

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
        }));
        const refsFor = (family) => entries.filter((entry) => entry.family === family);
        const pageEntries = refsFor('/css/page.css');
        const proseEntries = refsFor('/css/prose.css');
        const allowedFamilies = new Set(['/css/page.css']);
        if (row.hasProse) {
            allowedFamilies.add('/css/prose.css');
        }
        if (row.hasPageHome) {
            allowedFamilies.add('/css/page-home.css');
        }
        const unexpectedEntries = entries.filter(({ family }) => (
            !allowedFamilies.has(family)
            && !(row.hasPageHome && family.startsWith('/css/page-home-scene.'))
        ));

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

        if (row.hasPageHome) {
            const pageHomeStyleCount = refsFor('/css/page-home.css').length;
            const sceneCount = entries.filter(({ family }) => family.startsWith('/css/page-home-scene.')).length;
            if (entries.length !== 3 || pageHomeStyleCount !== 1 || sceneCount !== 1) {
                issues.push(`${row.relativePath}: homepage must keep page.css plus one page-home.css and one scene stylesheet; got ${row.stylesheetRefs.join(', ') || '<none>'}.`);
            }
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

    const prefetchDebugRows = rows.filter((row) => /(^|\/)prefetchdebug\/index\.html$/i.test(row.relativePath));
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
    const refs = extractStylesheetHrefs(page.text).map(ref => localReference(ref,{siteURL,page:page.relativePath})).filter(Boolean).map(ref => '/' + ref);
    const missing = [];
    for (const ref of refs) if (!await isFile(insideOutput(root,ref.slice(1)))) missing.push(ref);
    return {...pageState(page),stylesheetRefs:refs,stylesheetFamilyKeys:refs.map(normalizeCssAssetFamilyKey),
      hasProse:hasClassToken(page.text,'prose'),hasPageHome:hasClassToken(page.text,'page-home'),
      missingStylesheetRefs:missing};
  }));
  return inspectStylesheetContract(rows);
}
