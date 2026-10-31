import {readPages} from '../../../_shared/html/read.mjs';
import {extractTagAttribute,extractStartTags} from '../../../_shared/html/markup.mjs';
import {extractBlocks} from '../../../_shared/html/blocks.mjs';
import {readBreadcrumbData} from '../../../_shared/html/breadcrumb.mjs';

function inspectBreadcrumbPrefetchContract(text) {
    const issues = [];
    let breadcrumbAnchorCount = 0;

    const navigation = extractBlocks(text, 'nav', tag => extractTagAttribute(tag, 'data-slot') === 'breadcrumb');
    for (const tag of navigation.flatMap(node => extractStartTags(node.inner, 'a'))) {
        breadcrumbAnchorCount += 1;
        const slot = extractTagAttribute(tag, 'data-prefetch-slot');
        if (!slot && !/\sdata-prefetch-slot(?:\s|=|>)/i.test(tag)) continue;

        issues.push({
            href: extractTagAttribute(tag, 'href'),
            slot: slot || '<missing>'
        });
    }

    return {
        breadcrumbAnchorCount,
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


export function breadcrumbRows(pages,{directory}={}) {
  const cache=new Map();
  return pages.map(page => {
    const {sources,columns,navigationText,error}=readBreadcrumbData(page.text,{directory,pagePath:page.relativePath,cache});
    return {...page,breadcrumbParseError:error,breadcrumbPayloadBytes:Buffer.byteLength(navigationText),
      breadcrumbSourceCount:sources.length,breadcrumbItemCount:countCompactBreadcrumbItems(columns),
      breadcrumbSourcePaths:sources.map(value => value?.logicalPath).filter(value => typeof value === 'string'),
      ...inspectBreadcrumbPrefetchContract(page.text)};
  });
}
export async function inspect(directory) {
  const {pages} = await readPages(directory), issues = [];
  for (const row of breadcrumbRows(pages,{directory})) {
    if (row.breadcrumbParseError) issues.push(`Invalid breadcrumb payload on ${row.relativePath}: ${row.breadcrumbParseError}`);
    if (/\sdata-breadcrumb-collection-source\s*=/i.test(row.text)) {
      issues.push('Breadcrumb collection source JSON must come from the page registry: ' + row.relativePath);
    }
    for (const issue of row.breadcrumbPrefetchIssues) {
      issues.push(`Breadcrumb anchor must not use data-prefetch-slot: ${row.relativePath} href=${issue.href || '<empty>'}`);
    }
  }
  return {issues};
}
