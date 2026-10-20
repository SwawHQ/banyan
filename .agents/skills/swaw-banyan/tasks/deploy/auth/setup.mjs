import {helpFor} from '../../_shared/arguments.mjs';
import {startAuthPage,openAuthPage} from './page.mjs';

export async function setup(command,platform = 'cloudflare') {
  const args = process.argv.slice(2);
  try {
    if (args.length === 1 && ['--help','-h'].includes(args[0])) {console.log(helpFor({command}));return;}
    if (args.length > 1 || (args.length && args[0] !== '--no-browser')) throw new Error('invalid_auth_setup_arguments');
    const page = await startAuthPage({platform});
    const stop = ()=>page.close();
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
    console.error('[swban] Open this local URL: '+page.url);
    try {
      if (!args.length) await openAuthPage(page.url);
      const result = await page.completed;
      console.log(JSON.stringify({action:result}));
    } finally {page.close();process.off('SIGINT',stop);process.off('SIGTERM',stop);}
  } catch (error) {console.error('[swban] '+error.message);process.exitCode = 1;}
}
