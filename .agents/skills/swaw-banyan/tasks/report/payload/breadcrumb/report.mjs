import {readPages} from '../../../_shared/html/read.mjs';
import {breadcrumbRows} from '../../../check/html/breadcrumb/inspect.mjs';
export async function report(directory,top) {
  const {pages} = await readPages(directory), rows = breadcrumbRows(pages);
  console.log(`Breadcrumb payload report: ${rows.length} pages; top ${top}`);
  console.log('Total bytes\t' + rows.reduce((sum,row) => sum + row.breadcrumbPayloadBytes,0));
  for (const row of rows.sort((a,b) => b.breadcrumbPayloadBytes - a.breadcrumbPayloadBytes).slice(0,top)) {
    console.log(`${row.relativePath}\tbytes=${row.breadcrumbPayloadBytes}\titems=${row.breadcrumbItemCount}\tsources=${row.breadcrumbSourceCount}`);
    if (row.breadcrumbParseError) console.log('Parse issue\t' + row.breadcrumbParseError);
  }
}
