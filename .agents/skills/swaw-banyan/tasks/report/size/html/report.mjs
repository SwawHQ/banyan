import {readPages} from '../../../_shared/html/read.mjs';
import {gzipBytes} from '../../../_shared/size.mjs';
import {measureJs} from '../../../_shared/size-js.mjs';
export async function report(directory,top) {
  const {root,pages} = await readPages(directory), {costs} = await measureJs(root,pages);
  const rows = pages.map(page => ({path:page.relativePath,raw:page.buffer.length,gzip:gzipBytes(page.buffer),js:costs.get(page.relativePath).gzip}));
  console.log(`HTML size report: ${rows.length} pages; top ${top}`);
  console.log('Total raw bytes\t' + rows.reduce((sum,row) => sum + row.raw,0));
  console.log('Total gzip bytes\t' + rows.reduce((sum,row) => sum + row.gzip,0));
  for (const row of rows.sort((a,b) => b.gzip + b.js - a.gzip - a.js || a.path.localeCompare(b.path)).slice(0,top)) {
    console.log(`${row.path}\traw=${row.raw}\tgzip=${row.gzip}\tjs_gzip=${row.js}\tcold_gzip=${row.gzip + row.js}`);
  }
}
