import {helpFor} from '../../../../../_shared/arguments.mjs';
import {credentialStore,credentialTarget} from '../../credentials.mjs';
const args = process.argv.slice(2);
try {
  if (args.length === 1 && ['--help','-h'].includes(args[0])) console.log(helpFor({command:'deploy/tencent/auth/key/check'}));
  else {
    if (args.length) throw new Error('unexpected_arguments');
    const record = await credentialStore('check');
    console.log(JSON.stringify({target:credentialTarget,present:!!record}));
    if (!record) process.exitCode = 1;
  }
} catch (error) {console.error('[swban] '+error.message);process.exitCode = 1;}
