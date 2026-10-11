import {parseReport} from '../../../_shared/cli.mjs';
import {report} from './report.mjs';
try {
  const options = parseReport(process.argv.slice(2));
  if (options === null) console.log('swban report/payload/prefetch [dir] [--top N]  #Report costs; defaults: public, top 8');
  else await report(options.directory,options.top);
} catch (error) { console.error(error.message); process.exitCode = 1; }
