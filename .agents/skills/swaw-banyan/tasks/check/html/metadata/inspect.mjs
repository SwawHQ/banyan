import {readPages,pageState} from '../../../_shared/html/read.mjs';
import {extractTagAttribute,extractStartTags,extractElementText,extractMetaContent} from '../../../_shared/html/markup.mjs';

function metadataRows(pages) {
  return pages.map(page => ({
    ...pageState(page),
    htmlLang:extractTagAttribute(extractStartTags(page.text,'html')[0] ?? '','lang'),
    browserTitle:extractElementText(page.text,'title'),
    metaDescription:extractMetaContent(page.text,'description')
  }));
}
function duplicateGroups(rows,field) {
  const groups = new Map();
  for (const row of rows) {
    if (row.isRedirect || row.isNoindex || !row[field]?.trim()) continue;
    const key = row.htmlLang + '\0' + row[field].trim();
    const group = groups.get(key) ?? {lang:row.htmlLang,value:row[field].trim(),paths:[]};
    group.paths.push(row.relativePath); groups.set(key,group);
  }
  return [...groups.values()].filter(group => group.paths.length > 1);
}
export async function inspect(directory) {
  const {pages} = await readPages(directory);
  const rows = metadataRows(pages), issues = [];
  for (const row of rows) {
    if (!row.canonicalHref) issues.push('Missing canonical link: ' + row.relativePath);
    if (row.isRedirect) continue;
    if (!row.htmlLang) issues.push('Missing html lang attribute: ' + row.relativePath);
    if (!row.browserTitle) issues.push('Missing browser title: ' + row.relativePath);
    if (!row.metaDescription) issues.push('Missing meta description: ' + row.relativePath);
    if (/(^|\/)404\.html$/i.test(row.relativePath) && !row.isNoindex) issues.push('404 page must render noindex: ' + row.relativePath);
  }
  for (const group of duplicateGroups(rows,'metaDescription')) {
    issues.push(`Duplicate meta description within ${group.lang}: ${group.paths.join(', ')}`);
  }
  return {issues};
}
