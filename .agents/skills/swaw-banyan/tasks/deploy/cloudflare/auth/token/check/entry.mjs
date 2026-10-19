import {helpFor} from '../../../../../_shared/arguments.mjs';
import {inspectCredential} from '../../../_shared/credentials.mjs';

const args = process.argv.slice(2);
try {
  if (args.length === 1 && ['--help','-h'].includes(args[0])) console.log(helpFor({command:'deploy/cloudflare/auth/token/check'}));
  else {
    if (args.length) throw new Error('check_is_read_only; no additional arguments accepted');
    const result = await inspectCredential();
    console.log(JSON.stringify(result));
    if (!result.present) process.exitCode = 1;
  }
} catch (error) { console.error(`[swban] ${error.message}`); process.exitCode = 1; }
