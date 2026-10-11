import {readPages,pageState} from '../../../_shared/html/read.mjs';
import {extractStartTags} from '../../../_shared/html/markup.mjs';
export async function inspect(directory) {
  const {pages} = await readPages(directory);
  const issues = [];
  for (const page of pages.map(pageState)) {
    if (page.isRedirect || page.isNoindex) continue;
    const count = extractStartTags(page.text,'h1').length;
    if (count > 1) issues.push(`Indexable page must not render multiple H1 elements: ${page.relativePath} count=${count}`);
  }
  return {issues};
}
