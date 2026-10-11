import {readPages} from '../../../_shared/html/read.mjs';
import {prefetchRows} from '../../../check/prefetch/payload/inspect.mjs';
export async function report(directory,top) {
  const {pages} = await readPages(directory), rows = prefetchRows(pages);
  console.log(`Prefetch payload report: ${rows.length} pages; top ${top}`);
  console.log('Total bytes\t' + rows.reduce((sum,row) => sum + row.prefetchPayloadBytes,0));
  console.log('Unique URLs\t' + new Set(rows.flatMap(row => row.prefetchUniqueUrls)).size);
  for (const row of rows.sort((a,b) => b.prefetchPayloadBytes - a.prefetchPayloadBytes).slice(0,top)) {
    console.log(`${row.relativePath}\tbytes=${row.prefetchPayloadBytes}\tenvironments=${row.prefetchEnvCount}\turls=${row.prefetchUniqueUrlCount}\tspec=${row.prefetchSpecUrlCount}\tlink=${row.prefetchLinkUrlCount}\tsw=${row.prefetchSwUrlCount}`);
    if (row.prefetchParseError) console.log('Parse issue\t' + row.prefetchParseError);
  }
}
