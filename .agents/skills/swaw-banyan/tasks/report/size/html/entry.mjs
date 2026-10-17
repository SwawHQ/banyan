import {helpFor} from '../../../_shared/arguments.mjs';
import {parseReport} from '../../../_shared/cli.mjs';
import {report} from './report.mjs';
try {
  const options = parseReport(process.argv.slice(2));
  if (options === null) console.log(helpFor({command:'report/size/html'}));
  else await report(options.directory,options.top);
} catch (error) { console.error(error.message); process.exitCode = 1; }
