import {readPages} from '../../../_shared/html/read.mjs';
import {decodeHtmlAttribute,extractAttribute} from '../../../_shared/html/markup.mjs';
import {extractTagAttribute} from '../../../_shared/html/markup.mjs';

function inspectBreadcrumbPrefetchContract(text) {
    const issues = [];
    let breadcrumbAnchorCount = 0;
    let breadcrumbCrumbAnchorCount = 0;

    let depth = 0;
    for (const [tag] of text.matchAll(/<\/?div\b[^>]*>|<a\b[^>]*>/gi)) {
        if (/^<\/div/i.test(tag)) {
            if (depth) depth -= 1;
            continue;
        }
        if (/^<div/i.test(tag)) {
            if (depth || extractTagAttribute(tag, 'data-slot') === 'breadcrumb') depth += 1;
            continue;
        }
        if (!depth) continue;
        breadcrumbAnchorCount += 1;
        const slot = extractTagAttribute(tag, 'data-prefetch-slot');
        if (slot === 'crumb') {
            breadcrumbCrumbAnchorCount += 1;
            continue;
        }

        issues.push({
            href: extractTagAttribute(tag, 'href'),
            slot: slot || '<missing>'
        });
    }

    return {
        breadcrumbAnchorCount,
        breadcrumbCrumbAnchorCount,
        breadcrumbPrefetchIssues: issues
    };
}

function countCompactBreadcrumbItems(value) {
    if (Array.isArray(value)) {
        return value.reduce((total, entry) => total + countCompactBreadcrumbItems(entry), 0);
    }
    if (!value || typeof value !== 'object') {
        return 0;
    }

    const fields = value.f;
    const rowVector = value.rv;
    if (Array.isArray(fields) && fields.length > 0 && Array.isArray(rowVector)) {
        return rowVector.length % fields.length === 0
            ? rowVector.length / fields.length
            : 0;
    }

    return Object.values(value)
        .reduce((total, entry) => total + countCompactBreadcrumbItems(entry), 0);
}


export function breadcrumbRows(pages) {
  return pages.map(page => {
    const source = decodeHtmlAttribute(extractAttribute(page.text,'data-entry-breadcrumb-sources'));
    let breadcrumbParseError = '', sources = [];
    if (source) {
      try {
        const value = JSON.parse(source);
        if (!Array.isArray(value)) breadcrumbParseError = 'data-entry-breadcrumb-sources is not a JSON array';
        else sources = value;
      } catch (error) { breadcrumbParseError = error.message; }
    }
    return {...page,breadcrumbParseError,breadcrumbPayloadBytes:Buffer.byteLength(source),
      breadcrumbSourceCount:sources.length,breadcrumbItemCount:countCompactBreadcrumbItems(sources),
      breadcrumbSourcePaths:sources.map(value => value?.logical_path).filter(value => typeof value === 'string'),
      ...inspectBreadcrumbPrefetchContract(page.text)};
  });
}
export async function inspect(directory) {
  const {pages} = await readPages(directory), issues = [];
  for (const row of breadcrumbRows(pages)) {
    if (row.breadcrumbParseError) issues.push(`Invalid breadcrumb payload on ${row.relativePath}: ${row.breadcrumbParseError}`);
    if (/\sdata-breadcrumb-collection-source\s*=/i.test(row.text)) {
      issues.push('Breadcrumb collection source JSON must come from the page registry: ' + row.relativePath);
    }
    for (const issue of row.breadcrumbPrefetchIssues) {
      issues.push(`Breadcrumb anchor must use data-prefetch-slot="crumb": ${row.relativePath} href=${issue.href || '<empty>'} slot=${issue.slot}`);
    }
  }
  return {issues};
}
