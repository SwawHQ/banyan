import {readPages} from '../../../_shared/html/read.mjs';
import {extractInlineScriptTextById,extractExternalScriptSrcs} from '../../../_shared/html/markup.mjs';

function parsePrefetchPayload(scriptText) {
    const empty = {
        prefetchPayloadBytes: 0,
        prefetchEnvCount: 0,
        prefetchCanonicalEnvCount: 0,
        prefetchUniqueUrlCount: 0,
        prefetchUniqueUrls: [],
        prefetchSpecUrlCount: 0,
        prefetchLinkUrlCount: 0,
        prefetchSwUrlCount: 0,
        prefetchGlobalGateUrlCount: 0,
        prefetchParseError: '',
    };

    if (scriptText === '') {
        return empty;
    }

    const trimmed = scriptText.trim();
    const stats = {
        ...empty,
        prefetchPayloadBytes: Buffer.byteLength(trimmed),
    };

    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    } catch (error) {
        stats.prefetchParseError = error instanceof Error ? error.message : String(error);
        return stats;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        stats.prefetchParseError = 'site-prefetch-data is not a JSON object';
        return stats;
    }

    stats.prefetchEnvCount = Object.keys(parsed).length;

    const uniqueUrls = new Set();
    const canonicalEntries = Object.values(parsed).filter((value) => value && typeof value === 'object' && !Array.isArray(value));
    stats.prefetchCanonicalEnvCount = canonicalEntries.length;

    for (const entry of canonicalEntries) {
        for (const [actionCode, actionValue] of Object.entries(entry)) {
            if (actionCode === 'sp' || actionCode === 'sg') {
                if (!actionValue || typeof actionValue !== 'object' || Array.isArray(actionValue)) {
                    continue;
                }
                for (const ruleKind of ['prefetch', 'prerender']) {
                    const rules = Array.isArray(actionValue[ruleKind]) ? actionValue[ruleKind] : [];
                    for (const rule of rules) {
                        const urls = Array.isArray(rule?.urls) ? rule.urls.filter((url) => typeof url === 'string' && url) : [];
                        stats.prefetchSpecUrlCount += urls.length;
                        if (actionCode === 'sg') {
                            stats.prefetchGlobalGateUrlCount += urls.length;
                        }
                        for (const url of urls) {
                            uniqueUrls.add(url);
                        }
                    }
                }
                continue;
            }

            if (!Array.isArray(actionValue)) {
                continue;
            }

            const urls = actionValue.filter((url) => typeof url === 'string' && url);
            if (actionCode.startsWith('l')) {
                stats.prefetchLinkUrlCount += urls.length;
            }
            if (actionCode.startsWith('w')) {
                stats.prefetchSwUrlCount += urls.length;
            }
            if (actionCode.endsWith('g')) {
                stats.prefetchGlobalGateUrlCount += urls.length;
            }
            for (const url of urls) {
                uniqueUrls.add(url);
            }
        }
    }

    stats.prefetchUniqueUrls = [...uniqueUrls];
    stats.prefetchUniqueUrlCount = stats.prefetchUniqueUrls.length;
    return stats;
}


export function prefetchRows(pages) {
  return pages.map(page => ({...page,...parsePrefetchPayload(extractInlineScriptTextById(page.text,'site-prefetch-data'))}));
}
export async function inspect(directory) {
  const {pages} = await readPages(directory), issues = [];
  for (const row of prefetchRows(pages)) {
    const hasRuntime = extractExternalScriptSrcs(row.text).some(ref => /\/js\/prefetch\.runtime[^"' >]*\.js/i.test(ref));
    if (row.prefetchParseError) issues.push(`Invalid prefetch payload on ${row.relativePath}: ${row.prefetchParseError}`);
    if (row.prefetchPayloadBytes > 0 && !hasRuntime) issues.push('Missing prefetch runtime bundle on page with prefetch payload: ' + row.relativePath);
    if (!row.prefetchPayloadBytes && hasRuntime) issues.push('Unexpected prefetch runtime bundle without payload: ' + row.relativePath);
  }
  return {issues};
}
