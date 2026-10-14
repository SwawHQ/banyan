import {readPages} from '../../../_shared/html/read.mjs';
import {prefetchRows} from '../../../check/prefetch/payload/inspect.mjs';
export async function report(directory,top) {
  const {pages} = await readPages(directory), rows = prefetchRows(pages);
  console.log(`Prefetch payload report: ${rows.length} pages; top ${top}`);
  console.log('Total bytes\t' + rows.reduce((sum,row) => sum + row.prefetchPayloadBytes,0));
  for (const row of rows.sort((a,b) => b.prefetchPayloadBytes - a.prefetchPayloadBytes).slice(0,top)) {
    console.log(`${row.relativePath}\tbytes=${row.prefetchPayloadBytes}\trules=${row.prefetchRuleCount}\tprerender=${row.prefetchPrerenderRuleCount}`);
    if (row.prefetchParseError) console.log('Parse issue\t' + row.prefetchParseError);
  }
}
