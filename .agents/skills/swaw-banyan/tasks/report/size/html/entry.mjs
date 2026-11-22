import {parseReport} from '../../../_shared/cli.mjs';
import {report} from './report.mjs';
try {
  const options = parseReport(process.argv.slice(2));
  await report(options.directory,options.top);
} catch (error) { console.error(error.message); process.exitCode = 1; }
