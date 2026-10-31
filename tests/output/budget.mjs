import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseDirectory,printCheck} from '../../.agents/skills/swaw-banyan/tasks/_shared/cli.mjs';
import {formatByteMetric} from '../../.agents/skills/swaw-banyan/tasks/_shared/html/format.mjs';
import {readPages} from '../../.agents/skills/swaw-banyan/tasks/_shared/html/read.mjs';
import {gzipBytes} from '../../.agents/skills/swaw-banyan/tasks/_shared/size.mjs';
import {extractTagAttribute,extractStartTags} from '../../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';
import {breadcrumbRows} from '../../.agents/skills/swaw-banyan/tasks/check/html/breadcrumb/inspect.mjs';
import {imagePages,imageBytes,generatedImage} from '../../.agents/skills/swaw-banyan/tasks/_shared/img.mjs';

const maxPageBreadcrumbPayloadBytes = 64 * 1024;

// These guardrails intentionally target minified production output.
// Collection payloads grow with published rows, so constrain their fixed and
// per-item costs separately instead of recalibrating one total after each post.
const productionGuardrails = [
    {
        label: 'home',
        relativePath: 'index.html',
        // The canvas adds about 1 KB of inline positioning before first paint.
        maxRawBytes: 21_000,
        // Restoring the cloud/moon theme sprite adds about 180 B gzip.
        maxGzipBytes: 7_200,
        maxBreadcrumbPayloadBytes: 256,
        maxBreadcrumbSourceCount: 0
    },
    ...['articles-all','products-all'].map(name=>({
        label: name,
        rootCollectionSlug: name,
        relativePathLabel: `*/${name}/index.html`,
        // The critical root/path boot modules are bundled inline before first paint.
        // Keep the shell and each published row bounded independently so normal
        // content growth does not require recalibrating a fixed total.
        rawBaseBytes: 28_000,
        rawPerItemBytes: 1_500,
        gzipBaseBytes: 10_000,
        gzipPerItemBytes: 100,
        breadcrumbPayloadBaseBytes: 1_000,
        breadcrumbPayloadPerItemBytes: 220,
        maxBreadcrumbSourceCount: 1
    })),
    ...['articles','products'].map(name=>({
        label: name,
        rootCollectionSlug: name,
        relativePathLabel: `*/${name}/index.html`,
        rawBaseBytes: 28_000,
        rawPerItemBytes: 1_500,
        gzipBaseBytes: 8_000,
        gzipPerItemBytes: 100,
        breadcrumbPayloadBaseBytes: 1_300,
        breadcrumbPayloadPerItemBytes: 220,
        maxBreadcrumbSourceCount: 1
    }))
];

function getGuardrailRows(rowsByPath, guardrail) {
    if (guardrail.relativePath) {
        const row = rowsByPath.get(guardrail.relativePath);
        return row ? [row] : [];
    }
    if (guardrail.rootCollectionSlug) {
        return [...rowsByPath.values()]
            .filter((row) => {
                const segments = row.relativePath.split('/');
                return (
                    segments.length === 2
                    && segments[0] === guardrail.rootCollectionSlug
                    && segments[1] === 'index.html'
                ) || (
                    segments.length === 3
                    && segments[0] === row.htmlLang
                    && segments[1] === guardrail.rootCollectionSlug
                    && segments[2] === 'index.html'
                );
            });
    }
    return [];
}

function buildGuardrailIssues(rowsByPath) {
    const issues = [];

    for (const row of rowsByPath.values()) {
        if (row.breadcrumbPayloadBytes > maxPageBreadcrumbPayloadBytes) {
            issues.push(
                `Page breadcrumb payload exceeded the site-wide limit: ${formatByteMetric(row.breadcrumbPayloadBytes)} > ${formatByteMetric(maxPageBreadcrumbPayloadBytes)} (${row.relativePath}, items=${row.breadcrumbItemCount}, sources=${row.breadcrumbSourceCount})`
            );
        }
    }

    for (const guardrail of productionGuardrails) {
        const matchingRows = getGuardrailRows(rowsByPath, guardrail);
        if (matchingRows.length === 0) {
            // Optional collections are checked when the site publishes them.
            if (guardrail.relativePath) issues.push(`Missing sentinel page: ${guardrail.relativePath}`);
            continue;
        }
        for (const row of matchingRows) {
            const maxRawBytes = Number.isFinite(guardrail.maxRawBytes)
                ? guardrail.maxRawBytes
                : guardrail.rawBaseBytes + row.breadcrumbItemCount * guardrail.rawPerItemBytes;
            const maxGzipBytes = Number.isFinite(guardrail.maxGzipBytes)
                ? guardrail.maxGzipBytes
                : guardrail.gzipBaseBytes + row.breadcrumbItemCount * guardrail.gzipPerItemBytes;
            if (row.rawBytes > maxRawBytes) {
                issues.push(
                    `${guardrail.label} raw HTML exceeded budget: ${formatByteMetric(row.rawBytes)} > ${formatByteMetric(maxRawBytes)} (${row.relativePath}, items=${row.breadcrumbItemCount})`
                );
            }
            if (row.gzipBytes > maxGzipBytes) {
                issues.push(
                    `${guardrail.label} gzip HTML exceeded budget: ${formatByteMetric(row.gzipBytes)} > ${formatByteMetric(maxGzipBytes)} (${row.relativePath}, items=${row.breadcrumbItemCount})`
                );
            }
            const maxBreadcrumbPayloadBytes = Number.isFinite(guardrail.maxBreadcrumbPayloadBytes)
                ? guardrail.maxBreadcrumbPayloadBytes
                : guardrail.breadcrumbPayloadBaseBytes
                    + row.breadcrumbItemCount * guardrail.breadcrumbPayloadPerItemBytes;
            if (row.breadcrumbPayloadBytes > maxBreadcrumbPayloadBytes) {
                issues.push(
                    `${guardrail.label} breadcrumb payload exceeded budget: ${formatByteMetric(row.breadcrumbPayloadBytes)} > ${formatByteMetric(maxBreadcrumbPayloadBytes)} (${row.relativePath}, items=${row.breadcrumbItemCount})`
                );
            }
            if (row.breadcrumbSourceCount > guardrail.maxBreadcrumbSourceCount) {
                issues.push(
                    `${guardrail.label} breadcrumb source count exceeded budget: ${row.breadcrumbSourceCount} > ${guardrail.maxBreadcrumbSourceCount} (${row.relativePath})`
                );
            }
        }
    }

    return issues;
}

export async function inspectHtmlBudget(directory) {
  const {pages} = await readPages(directory);
  const rows = breadcrumbRows(pages,{directory}).map(row => ({...row,rawBytes:row.buffer.length,gzipBytes:gzipBytes(row.buffer),
    htmlLang:extractTagAttribute(extractStartTags(row.text,'html')[0] ?? '','lang')}));
  return {issues:buildGuardrailIssues(new Map(rows.map(row => [row.relativePath,row])))};
}

export const maxShareImageBytes = 500_000;

export async function inspectShareImageBudget(directory) {
  const {root,pages,siteURL}=await imagePages(directory),issues=[],seen=new Set();
  for(const page of pages)for(const tag of extractStartTags(page.text,'meta')) {
    const kind=extractTagAttribute(tag,'property')||extractTagAttribute(tag,'name'),src=extractTagAttribute(tag,'content');
    if(!['og:image','twitter:image'].includes(kind)||!generatedImage(src,siteURL)||seen.has(src))continue;
    seen.add(src);
    const bytes=await imageBytes(root,src,siteURL);
    if(bytes&&bytes.length>maxShareImageBytes)issues.push('Generated share image exceeds '+maxShareImageBytes+' bytes: '+src);
  }
  return {issues};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const directory=parseDirectory(process.argv.slice(2));
    if(directory===null)console.log('tests/output/budget.mjs [dir]  #Check repository production budgets; default: public');
    else {
      printCheck('HTML budget',await inspectHtmlBudget(directory));
      printCheck('Share image budget',await inspectShareImageBudget(directory));
    }
  } catch(error){console.error(error.message);process.exitCode=1;}
}
